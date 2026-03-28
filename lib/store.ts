import { create } from 'zustand'
import { createBrowserClient } from '@/lib/supabase'
import { snapVeo31DurationSeconds } from '@/lib/veo-duration'
import type {
  Project,
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
  updateProjectStatus: (status: ProjectStatus) => void
  setMusicUrl: (url: string) => void
  setFinalVideoUrl: (url: string) => void

  startGeneration: () => Promise<void>
  generateVideoForScene: (sceneId: string) => Promise<void>
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

  setFinalVideoUrl: (url) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, finalVideoUrl: url } }
    }),

  startGeneration: async () => {
    const { lessonData, avatarType, voiceCharacterId } = get()
    if (!lessonData) {
      console.warn('startGeneration: lessonData is missing')
      return
    }

    const preservedCharacterAnglesUrl = get().project?.characterAnglesUrl ?? null

    set({
      project: {
        id: 'pending',
        sessionId: '',
        status: 'scripting',
        lessonPrompt: lessonData.lessonPrompt,
        pdfUrl: lessonData.uploadedFileUrl ?? null,
        avatarType,
        voiceCharacterId,
        script: null,
        scenes: [],
        musicUrl: null,
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
          status: 'generating_assets',
          lessonPrompt: lessonData.lessonPrompt,
          pdfUrl: lessonData.uploadedFileUrl ?? null,
          avatarType,
          voiceCharacterId,
          script: data.script,
          scenes: data.scenes,
          musicUrl: null,
          finalVideoUrl: null,
          characterAnglesUrl: preservedCharacterAnglesUrl,
        },
        currentTab: 'script',
      })

      const characterAnglesUrlForThumbnails =
        avatarType === 'default_male'
          ? process.env.NEXT_PUBLIC_DEFAULT_MALE_ANGLES_URL
          : avatarType === 'default_female'
            ? process.env.NEXT_PUBLIC_DEFAULT_FEMALE_ANGLES_URL
            : avatarType === 'custom'
              ? get().project?.characterAnglesUrl ?? undefined
              : undefined

      const scenesOrdered = [...data.scenes].sort((a, b) => a.order - b.order)

      for (const scene of scenesOrdered) {
        try {
          get().updateScene(scene.id, { status: 'thumbnail_generating' })

          const thumbBody: Record<string, string> = {
            sceneId: scene.id,
            projectId: data.projectId,
            visualPrompt: scene.visualPrompt,
            artStyle: data.script.artStyle,
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

          if (!thumbRes.ok || !thumbJson.thumbnailUrl) {
            console.error('generate-thumbnail failed:', thumbJson.error ?? thumbRes.status)
            get().updateScene(scene.id, { status: 'error' })
            continue
          }

          get().updateScene(scene.id, {
            thumbnailUrl: thumbJson.thumbnailUrl,
            status: 'thumbnail_ready',
          })
        } catch (thumbErr) {
          console.error('generate-thumbnail exception:', thumbErr)
          get().updateScene(scene.id, { status: 'error' })
        }
      }

      get().updateProjectStatus('idle')
    } catch (err) {
      console.error('startGeneration:', err)
      set({ project: null })
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
        durationSeconds: snapVeo31DurationSeconds(Number(scene.durationSeconds) || 6),
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

      // Step 4/5: mirror API (Supabase `video_url` + `video_ready`) so the right pane updates without waiting on Realtime.
      get().updateScene(sceneId, {
        videoUrl: videoJson.videoUrl,
        status: 'video_ready',
      })
    } catch (e) {
      console.error('generateVideoForScene:', e)
      get().updateScene(sceneId, { status: 'error' })
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
      final_video_url: string | null
      scenes: Array<Record<string, unknown>> | null
    }

    const rawScenes = r.scenes ?? []
    const scenesMapped: Scene[] = rawScenes
      .map((s) => ({
        id: String(s.id),
        order: Number(s.order),
        sceneType: s.scene_type as Scene['sceneType'],
        dialogue: String(s.dialogue),
        wordCount: Number(s.word_count),
        durationSeconds: Number(s.duration_seconds ?? 8),
        visualPrompt: String(s.visual_prompt),
        thumbnailUrl: (s.thumbnail_url as string | null) ?? null,
        // Dev reload: ignore stale DB statuses / prior videos so each scene can be re-run in the UI.
        videoUrl: null,
        status: 'thumbnail_ready' as Scene['status'],
      }))
      .sort((a, b) => a.order - b.order)

    const script = (r.script_json ?? null) as GeminiScriptOutput | null

    const totalDuration = scenesMapped.reduce((acc, s) => acc + s.durationSeconds, 0)

    const project: Project = {
      id: r.id,
      sessionId: r.session_id,
      // DB may still say scripting/generating_* from a failed run; treat loaded project as idle for UI.
      status: 'idle',
      lessonPrompt: r.lesson_prompt ?? '',
      pdfUrl: r.pdf_url,
      avatarType: r.avatar_type as AvatarType,
      voiceCharacterId: r.voice_character_id ?? 'raspy_lumberjack',
      characterAnglesUrl: r.character_angles_url,
      script,
      scenes: scenesMapped,
      musicUrl: r.music_url,
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
