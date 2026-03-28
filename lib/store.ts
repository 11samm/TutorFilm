import { create } from 'zustand'
import { createBrowserClient } from '@/lib/supabase'
import { countWords } from '@/lib/validate-script'
import { normalizeSceneDurationSeconds } from '@/lib/veo-duration'
import type { MockProjectStage } from '@/lib/mock-data'
import type {
  Project,
  ProjectStage,
  Scene,
  LessonData,
  ProjectStatus,
  AvatarType,
  GenerateScriptResponse,
  GeminiScriptOutput,
  TargetAgeBand,
} from './types'

function characterAnglesUrlForPipeline(
  avatarType: AvatarType,
  characterAnglesUrl: string | null | undefined
): string | undefined {
  if (avatarType === 'default_male') {
    return process.env.NEXT_PUBLIC_DEFAULT_MALE_ANGLES_URL
  }
  if (avatarType === 'default_female') {
    return process.env.NEXT_PUBLIC_DEFAULT_FEMALE_ANGLES_URL
  }
  if (avatarType === 'custom') {
    return characterAnglesUrl ?? undefined
  }
  return undefined
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function enrichSceneFromApi(s: Scene): Scene {
  return {
    ...s,
    confirmed: s.confirmed ?? false,
    scriptHtml: s.scriptHtml ?? s.dialogue,
    thumbnailPrompt: s.thumbnailPrompt ?? s.visualPrompt,
  }
}

const SCENE_STATUSES: Scene['status'][] = [
  'pending',
  'thumbnail_generating',
  'thumbnail_ready',
  'video_generating',
  'video_ready',
  'complete',
  'error',
]

function parseSceneStatusFromDb(raw: unknown): Scene['status'] {
  const s = typeof raw === 'string' ? raw : ''
  return SCENE_STATUSES.includes(s as Scene['status'])
    ? (s as Scene['status'])
    : 'pending'
}

/** Restore pipeline stage from persisted scene rows. */

/** Prevents duplicate concurrent `/api/stitch-video` runs for the same project. */
let stitchFinalInFlightProjectId: string | null = null

function deriveStageFromLoadedScenes(scenes: Scene[]): ProjectStage {
  if (scenes.length === 0) return 'script_approval'
  const allHaveThumb = scenes.every((s) => s.thumbnailUrl)
  const allHaveVideo = scenes.every((s) => s.videoUrl)
  if (allHaveVideo) return 'video_approval'

  const touchedVideoPipeline = scenes.some(
    (s) =>
      s.status === 'video_generating' ||
      s.status === 'video_ready' ||
      s.status === 'complete' ||
      s.status === 'error'
  )
  if (allHaveThumb && touchedVideoPipeline) return 'video_approval'

  if (allHaveThumb && scenes.every((s) => !s.videoUrl)) return 'thumbnail_approval'
  if (allHaveThumb) return 'video_approval'
  return 'script_approval'
}

export interface TutorFilmStore {
  // ── Setup phase ────────────────────────────────────────────────────────────
  lessonData: LessonData | null
  setLessonData: (data: LessonData) => void

  // ── Generation preferences ─────────────────────────────────────────────────
  avatarType: AvatarType
  setAvatarType: (avatarType: AvatarType) => void
  voiceCharacterId: string
  setVoiceCharacterId: (voiceCharacterId: string) => void

  // ── Project state (source of truth synced from Supabase) ──────────────────
  project: Project | null
  setProject: (project: Project) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  addScene: () => Promise<void>
  removeScene: (sceneId: string) => Promise<void>
  reorderScenes: (sceneIdsInOrder: string[]) => void
  injectMockProject: (stage: MockProjectStage) => Promise<void>
  updateProjectStatus: (status: ProjectStatus) => void
  setMusicUrl: (url: string) => void
  setAssembledScenesVideoUrl: (url: string | null) => void
  setFinalVideoUrl: (url: string) => void

  generateScript: () => Promise<void>
  generateThumbnailsForProject: () => Promise<void>
  generateVideosForProject: () => Promise<void>
  confirmStage: () => Promise<void>
  regenerateThumbnailForScene: (sceneId: string) => Promise<void>

  generateVideoForScene: (sceneId: string) => Promise<void>
  stitchSceneVideosForProject: () => Promise<void>
  generateMusicForProject: () => Promise<void>
  stitchFinalVideoForProject: () => Promise<void>
  loadLatestProjectFromDb: () => Promise<void>

  // ── UI state ───────────────────────────────────────────────────────────────
  currentTab: 'script' | 'thumbnails' | 'videos' | 'final'
  setCurrentTab: (tab: TutorFilmStore['currentTab']) => void
  hasStarted: boolean
  setHasStarted: (started: boolean) => void
}

export const useTutorFilmStore = create<TutorFilmStore>((set, get) => ({
  lessonData: null,
  setLessonData: (data) =>
    set({
      lessonData: {
        ...data,
        targetAge: data.targetAge ?? 'primary',
      },
    }),

  avatarType: 'none',
  setAvatarType: (avatarType) => set({ avatarType }),

  voiceCharacterId: 'raspy_lumberjack',
  setVoiceCharacterId: (voiceCharacterId) => set({ voiceCharacterId }),

  project: null,
  setProject: (project) => set({ project }),

  updateScene: (sceneId, updates) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          scenes: state.project.scenes.map((s) =>
            s.id === sceneId ? { ...s, ...updates } : s
          ),
        },
      }
    }),

  addScene: async () => {
    const project = get().project
    if (!project?.id || project.id === 'pending') return
    const scenes = project.scenes
    const maxOrder = scenes.length === 0 ? 0 : Math.max(...scenes.map((s) => s.order))
    const nextOrder = maxOrder + 1
    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          order: nextOrder,
          dialogue: '',
          visualPrompt: '',
          sceneType: 'mixed',
          durationSeconds: 6,
        }),
      })
      const json = (await res.json()) as { scene?: Scene; error?: string }
      if (!res.ok || !json.scene) {
        console.error('addScene failed:', json.error ?? res.status)
        return
      }
      set({
        project: {
          ...get().project!,
          scenes: [...get().project!.scenes, json.scene],
        },
      })
    } catch (e) {
      console.error('addScene:', e)
    }
  },

  removeScene: async (sceneId) => {
    const project = get().project
    if (!project) return
    if (project.id !== 'pending') {
      try {
        const res = await fetch(`/api/scenes/${sceneId}`, { method: 'DELETE' })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string }
          console.error('removeScene failed:', err.error ?? res.status)
          return
        }
      } catch (e) {
        console.error('removeScene:', e)
        return
      }
    }
    set((state) => {
      if (!state.project) return state
      const filtered = state.project.scenes.filter((s) => s.id !== sceneId)
      const reindexed = filtered.map((s, i) => ({ ...s, order: i + 1 }))
      return {
        project: {
          ...state.project,
          scenes: reindexed,
        },
      }
    })
  },

  injectMockProject: async (stage) => {
    try {
      const res = await fetch('/api/dev/mock-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      const json = (await res.json()) as {
        project?: Project
        lessonData?: LessonData
        currentTab?: 'script' | 'thumbnails' | 'videos' | 'final'
        error?: string
      }
      if (!res.ok || !json.project || !json.lessonData) {
        console.error('injectMockProject:', json.error ?? res.status)
        return
      }
      set({
        hasStarted: true,
        project: json.project,
        lessonData: json.lessonData,
        avatarType: json.project.avatarType,
        voiceCharacterId: json.project.voiceCharacterId,
        currentTab: json.currentTab ?? 'script',
      })
    } catch (e) {
      console.error('injectMockProject:', e)
    }
  },

  reorderScenes: (sceneIdsInOrder) =>
    set((state) => {
      if (!state.project) return state
      if (sceneIdsInOrder.length !== state.project.scenes.length) return state
      const map = new Map(state.project.scenes.map((s) => [s.id, s]))
      const next: Scene[] = []
      for (let i = 0; i < sceneIdsInOrder.length; i++) {
        const scene = map.get(sceneIdsInOrder[i])
        if (!scene) return state
        next.push({ ...scene, order: i + 1 })
      }
      return {
        project: {
          ...state.project,
          scenes: next,
        },
      }
    }),

  updateProjectStatus: (status) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, status } }
    }),

  setMusicUrl: (url) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, musicUrl: url } }
    }),

  setAssembledScenesVideoUrl: (url) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, assembledScenesVideoUrl: url } }
    }),

  setFinalVideoUrl: (url) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, finalVideoUrl: url } }
    }),

  generateScript: async () => {
    const { lessonData, avatarType, voiceCharacterId } = get()
    if (!lessonData) {
      console.warn('generateScript: lessonData is missing')
      return
    }

    const preservedCharacterAnglesUrl = get().project?.characterAnglesUrl ?? null

    set({
      project: {
        id: 'pending',
        sessionId: '',
        status: 'scripting',
        stage: 'setup',
        lessonPrompt: lessonData.lessonPrompt,
        pdfUrl: lessonData.uploadedFileUrl ?? null,
        avatarType,
        voiceCharacterId,
        script: null,
        scenes: [],
        musicUrl: null,
        assembledScenesVideoUrl: null,
        finalVideoUrl: null,
        characterAnglesUrl: preservedCharacterAnglesUrl,
      },
    })

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonPrompt: lessonData.lessonPrompt,
          pdfUrl: lessonData.uploadedFileUrl ?? undefined,
          targetDurationSeconds: lessonData.duration,
          targetAge: lessonData.targetAge,
          avatarType,
          voiceCharacterId,
        }),
      })

      const payload = (await res.json()) as { error?: string } & Partial<GenerateScriptResponse>
      if (!res.ok) {
        throw new Error(payload.error || `Script generation failed (${res.status})`)
      }

      const data = payload as GenerateScriptResponse

      set({
        project: {
          id: data.projectId,
          sessionId: '',
          status: 'idle',
          stage: 'script_approval',
          lessonPrompt: lessonData.lessonPrompt,
          pdfUrl: lessonData.uploadedFileUrl ?? null,
          avatarType,
          voiceCharacterId,
          script: data.script,
          scenes: data.scenes.map(enrichSceneFromApi),
          musicUrl: null,
          assembledScenesVideoUrl: null,
          finalVideoUrl: null,
          characterAnglesUrl: preservedCharacterAnglesUrl,
        },
        currentTab: 'script',
      })
    } catch (err) {
      console.error('generateScript:', err)
      set({ project: null })
    }
  },

  generateThumbnailsForProject: async () => {
    const project = get().project
    if (!project?.id || project.id === 'pending') return
    if (!project.script) return

    const script = project.script

    const characterAnglesUrlForThumbnails =
      project.avatarType === 'default_male'
        ? process.env.NEXT_PUBLIC_DEFAULT_MALE_ANGLES_URL
        : project.avatarType === 'default_female'
          ? process.env.NEXT_PUBLIC_DEFAULT_FEMALE_ANGLES_URL
          : project.avatarType === 'custom'
            ? project.characterAnglesUrl ?? undefined
            : undefined

    get().updateProjectStatus('generating_assets')

    const scenesOrdered = [...project.scenes].sort((a, b) => a.order - b.order)
    const maxRetries = 3

    await Promise.all(
      scenesOrdered.map(async (scene) => {
        try {
          const sceneNow = get().project?.scenes.find((s) => s.id === scene.id)
          if (!sceneNow) return

          get().updateScene(scene.id, { status: 'thumbnail_generating' })

          const visualPrompt = sceneNow.thumbnailPrompt?.trim() || sceneNow.visualPrompt

          const thumbBody: Record<string, string> = {
            sceneId: scene.id,
            projectId: project.id,
            visualPrompt,
            artStyle: script.artStyle,
          }
          if (characterAnglesUrlForThumbnails) {
            thumbBody.characterAnglesUrl = characterAnglesUrlForThumbnails
          }

          let thumbnailSuccess = false
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const thumbRes = await fetch('/api/generate-thumbnail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(thumbBody),
              })

              const thumbJson = (await thumbRes.json()) as {
                thumbnailUrl?: string
                error?: string
              }

              if (thumbRes.ok && thumbJson.thumbnailUrl) {
                get().updateScene(scene.id, {
                  thumbnailUrl: thumbJson.thumbnailUrl,
                  status: 'thumbnail_ready',
                })
                thumbnailSuccess = true
                break
              }

              console.warn(
                'Thumbnail failed, retrying... Attempt',
                `${attempt}/${maxRetries}`,
                thumbJson.error ?? thumbRes.status
              )
            } catch (thumbErr) {
              console.warn('Thumbnail failed, retrying... Attempt', `${attempt}/${maxRetries}`, thumbErr)
            }

            if (!thumbnailSuccess && attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 1000))
            }
          }

          if (!thumbnailSuccess) {
            console.error('generate-thumbnail failed after all retries for scene', scene.id)
            get().updateScene(scene.id, { status: 'error' })
          }
        } catch (thumbErr) {
          console.error('generate-thumbnail exception:', thumbErr)
          get().updateScene(scene.id, { status: 'error' })
        }
      })
    )

    get().updateProjectStatus('idle')
  },

  generateVideosForProject: async () => {
    const project = get().project
    if (!project?.id) return

    get().updateProjectStatus('generating_videos')

    const ordered = [...project.scenes].sort((a, b) => a.order - b.order)
    await Promise.all(
      ordered.map(async (scene) => {
        try {
          const fresh = get().project?.scenes.find((s) => s.id === scene.id)
          if (!fresh?.thumbnailUrl) return

          await get().generateVideoForScene(scene.id)
        } catch (e) {
          console.error('generateVideosForProject scene failed:', scene.id, e)
          get().updateScene(scene.id, { status: 'error' })
        }
      })
    )

    get().updateProjectStatus('idle')
  },

  confirmStage: async () => {
    const project = get().project
    if (!project) return

    switch (project.stage) {
      case 'script_approval': {
        set((state) => {
          if (!state.project) return state
          const nextScenes = state.project.scenes.map((s) => {
            const dialogue = stripHtml(s.scriptHtml).trim() || s.dialogue
            const vp = (s.thumbnailPrompt?.trim() || s.visualPrompt).trim()
            return {
              ...s,
              dialogue,
              visualPrompt: vp,
              thumbnailPrompt: vp,
              wordCount: countWords(dialogue),
              confirmed: true,
            }
          })
          return {
            project: {
              ...state.project,
              stage: 'thumbnail_approval',
              scenes: nextScenes,
            },
          }
        })
        await get().generateThumbnailsForProject()
        break
      }
      case 'thumbnail_approval': {
        set({ project: { ...get().project!, stage: 'video_approval' } })
        await get().generateVideosForProject()
        break
      }
      case 'video_approval': {
        set({
          project: {
            ...get().project!,
            stage: 'final',
            status: 'stitching',
          },
        })
        void get().generateMusicForProject()
        await get().stitchSceneVideosForProject()
        break
      }
      default:
        break
    }
  },

  regenerateThumbnailForScene: async (sceneId: string) => {
    const project = get().project
    if (!project?.script || !project.id || project.id === 'pending') return
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (!scene) return

    const characterAnglesUrlForThumbnails =
      project.avatarType === 'default_male'
        ? process.env.NEXT_PUBLIC_DEFAULT_MALE_ANGLES_URL
        : project.avatarType === 'default_female'
          ? process.env.NEXT_PUBLIC_DEFAULT_FEMALE_ANGLES_URL
          : project.avatarType === 'custom'
            ? project.characterAnglesUrl ?? undefined
            : undefined

    const visualPrompt = scene.thumbnailPrompt?.trim() || scene.visualPrompt

    get().updateScene(sceneId, { status: 'thumbnail_generating' })

    const maxRetries = 3
    let thumbnailSuccess = false

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const thumbBody: Record<string, string> = {
          sceneId,
          projectId: project.id,
          visualPrompt,
          artStyle: project.script.artStyle,
        }
        if (characterAnglesUrlForThumbnails) {
          thumbBody.characterAnglesUrl = characterAnglesUrlForThumbnails
        }

        const thumbRes = await fetch('/api/generate-thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(thumbBody),
        })

        const thumbJson = (await thumbRes.json()) as {
          thumbnailUrl?: string
          error?: string
        }

        if (thumbRes.ok && thumbJson.thumbnailUrl) {
          get().updateScene(sceneId, {
            thumbnailUrl: thumbJson.thumbnailUrl,
            status: 'thumbnail_ready',
          })
          thumbnailSuccess = true
          break
        }

        console.warn(
          'Regenerate thumbnail failed, retrying...',
          `${attempt}/${maxRetries}`,
          thumbJson.error ?? thumbRes.status
        )
      } catch (e) {
        console.warn('Regenerate thumbnail failed, retrying...', `${attempt}/${maxRetries}`, e)
      }

      if (!thumbnailSuccess && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    if (!thumbnailSuccess) {
      get().updateScene(sceneId, { status: 'error' })
    }
  },

  currentTab: 'script',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  hasStarted: false,
  setHasStarted: (started) => set({ hasStarted: started }),

  generateVideoForScene: async (sceneId: string) => {
    const { project, avatarType } = get()
    if (!project?.id) return
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (!scene?.thumbnailUrl) return

    const angles = characterAnglesUrlForPipeline(avatarType, project.characterAnglesUrl)

    get().updateScene(sceneId, { status: 'video_generating' })

    try {
      const videoBody: Record<string, string | number> = {
        sceneId,
        projectId: project.id,
        thumbnailUrl: scene.thumbnailUrl,
        visualPrompt: scene.visualPrompt,
        dialogue: scene.dialogue,
        voiceCharacterId: project.voiceCharacterId,
        durationSeconds: normalizeSceneDurationSeconds(Number(scene.durationSeconds) || 6),
      }
      if (angles) {
        videoBody.characterAnglesUrl = angles
      }

      const videoRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoBody),
      })

      const videoJson = (await videoRes.json()) as {
        videoUrl?: string
        error?: string
      }

      if (!videoRes.ok || !videoJson.videoUrl) {
        console.error('generate-video failed:', videoJson.error ?? videoRes.status)
        get().updateScene(sceneId, { status: 'error' })
        return
      }

      get().updateScene(sceneId, {
        videoUrl: videoJson.videoUrl,
        status: 'video_ready',
      })
    } catch (e) {
      console.error('generateVideoForScene:', e)
      get().updateScene(sceneId, { status: 'error' })
    }
  },

  generateMusicForProject: async () => {
    const project = get().project
    if (!project?.id || project.id === 'pending' || !project.script) return

    /** Parallel with scene stitch on first finalize — do not clobber `stitching` or clear music yet. */
    if (get().project?.status !== 'stitching') {
      set({
        project: {
          ...get().project!,
          status: 'composing_music',
          finalVideoUrl: null,
          musicUrl: null,
        },
      })
    } else if (get().project?.finalVideoUrl) {
      set({ project: { ...get().project!, finalVideoUrl: null } })
    }

    const durationSeconds = Math.max(
      8,
      project.scenes.reduce((acc, s) => acc + (Number(s.durationSeconds) || 6), 0),
    )

    try {
      console.log("Starting client-side music fetch for mood:", project.script.musicMood)
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          musicMood: project.script.musicMood,
          durationSeconds,
        }),
      })
      const json = (await res.json()) as { musicUrl?: string; error?: string }
      if (!res.ok || !json.musicUrl) {
        console.error('generate-music failed:', json.error ?? res.status)
        return
      }
      get().setMusicUrl(json.musicUrl)
      const after = get().project
      if (after?.assembledScenesVideoUrl && after.status !== 'stitching') {
        set({ project: { ...get().project!, status: 'final_preview' } })
      }
    } catch (e) {
      console.error('generateMusicForProject:', e)
    }
  },

  stitchFinalVideoForProject: async () => {
    const project = get().project
    if (!project?.id || project.id === 'pending') return
    if (!project.assembledScenesVideoUrl || !project.musicUrl) return
    if (stitchFinalInFlightProjectId === project.id) return

    stitchFinalInFlightProjectId = project.id
    set({
      project: {
        ...get().project!,
        status: 'muxing',
        finalVideoUrl: null,
      },
    })

    try {
      const res = await fetch('/api/stitch-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          assembledScenesVideoUrl: project.assembledScenesVideoUrl,
          musicUrl: project.musicUrl,
        }),
      })
      const json = (await res.json()) as { finalVideoUrl?: string; error?: string }
      if (!res.ok || !json.finalVideoUrl) {
        throw new Error(typeof json.error === 'string' ? json.error : 'Final mux failed')
      }
      set({
        project: {
          ...get().project!,
          finalVideoUrl: json.finalVideoUrl,
          status: 'complete',
        },
      })
    } catch (e) {
      console.error('stitchFinalVideoForProject:', e)
      set({ project: { ...get().project!, status: 'error' } })
    } finally {
      stitchFinalInFlightProjectId = null
    }
  },

  stitchSceneVideosForProject: async () => {
    const project = get().project
    if (!project?.id || project.id === 'pending') return

    const ordered = [...project.scenes].sort((a, b) => a.order - b.order)
    for (const s of ordered) {
      if (!s.videoUrl) {
        set({ project: { ...get().project!, status: 'error' } })
        return
      }
    }

    try {
      const res = await fetch('/api/stitch-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const json = (await res.json()) as {
        assembledScenesVideoUrl?: string
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || 'Stitch failed')
      }
      const musicUrl = get().project!.musicUrl
      set({
        project: {
          ...get().project!,
          assembledScenesVideoUrl: json.assembledScenesVideoUrl ?? null,
          status: musicUrl ? 'final_preview' : 'composing_music',
        },
      })
    } catch (e) {
      console.error('stitchSceneVideosForProject:', e)
      set({ project: { ...get().project!, status: 'error' } })
    }
  },

  loadLatestProjectFromDb: async () => {
    const supabase = createBrowserClient()
    const { data: row, error } = await supabase
      .from('projects')
      .select('*, scenes(*)')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('loadLatestProjectFromDb:', error)
      throw new Error(error.message || 'Failed to load project')
    }
    if (!row) {
      throw new Error('No project found')
    }

    const r = row as {
      id: string
      session_id: string
      status: string
      lesson_prompt: string | null
      pdf_url: string | null
      avatar_type: string
      voice_character_id: string | null
      character_angles_url: string | null
      script_json: unknown
      music_url: string | null
      assembled_scenes_video_url: string | null
      final_video_url: string | null
      scenes: Array<Record<string, unknown>> | null
    }

    const rawScenes = r.scenes ?? []
    const scenesMapped: Scene[] = rawScenes
      .map((s) => {
        const dialogue = String(s.dialogue)
        const visualPrompt = String(s.visual_prompt)
        return {
          id: String(s.id),
          order: Number(s.order),
          sceneType: s.scene_type as Scene['sceneType'],
          dialogue,
          wordCount: Number(s.word_count),
          durationSeconds: normalizeSceneDurationSeconds(
            Number(s.duration_seconds ?? 8)
          ),
          visualPrompt,
          thumbnailPrompt: visualPrompt,
          scriptHtml: dialogue,
          confirmed: true,
          thumbnailUrl: (s.thumbnail_url as string | null) ?? null,
          videoUrl: (s.video_url as string | null) ?? null,
          status: parseSceneStatusFromDb(s.status),
        }
      })
      .sort((a, b) => a.order - b.order)

    const script = (r.script_json ?? null) as GeminiScriptOutput | null

    const totalDuration = scenesMapped.reduce((acc, s) => acc + s.durationSeconds, 0)

    const restoredStage = deriveStageFromLoadedScenes(scenesMapped)

    const project: Project = {
      id: r.id,
      sessionId: r.session_id,
      status: 'idle',
      stage: restoredStage,
      lessonPrompt: r.lesson_prompt ?? '',
      pdfUrl: r.pdf_url,
      avatarType: r.avatar_type as AvatarType,
      voiceCharacterId: r.voice_character_id ?? 'raspy_lumberjack',
      characterAnglesUrl: r.character_angles_url,
      script,
      scenes: scenesMapped,
      musicUrl: r.music_url,
      assembledScenesVideoUrl: r.assembled_scenes_video_url ?? null,
      finalVideoUrl: r.final_video_url,
    }

    set({
      project,
      avatarType: project.avatarType,
      voiceCharacterId: project.voiceCharacterId,
      lessonData: {
        lessonPrompt: project.lessonPrompt,
        uploadedFile: null,
        uploadedFileUrl: project.pdfUrl,
        duration: totalDuration > 0 ? totalDuration : 30,
        targetAge: 'primary' as TargetAgeBand,
      },
      currentTab: 'script',
    })
  },
}))
