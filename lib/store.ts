import { create } from 'zustand'
import type {
  Project,
  Scene,
  LessonData,
  ProjectStatus,
  AvatarType,
  GenerateScriptResponse,
} from './types'

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

      get().updateProjectStatus('generating_videos')

      const characterAnglesUrlForVideo =
        avatarType === 'default_male'
          ? process.env.NEXT_PUBLIC_DEFAULT_MALE_ANGLES_URL
          : avatarType === 'default_female'
            ? process.env.NEXT_PUBLIC_DEFAULT_FEMALE_ANGLES_URL
            : avatarType === 'custom'
              ? get().project?.characterAnglesUrl ?? undefined
              : undefined

      const scenesForVideo = [...(get().project?.scenes ?? [])].sort((a, b) => a.order - b.order)

      for (const scene of scenesForVideo) {
        if (!scene.thumbnailUrl) {
          continue
        }
        try {
          get().updateScene(scene.id, { status: 'video_generating' })

          const videoBody: Record<string, string | number> = {
            sceneId: scene.id,
            projectId: data.projectId,
            thumbnailUrl: scene.thumbnailUrl,
            visualPrompt: scene.visualPrompt,
            dialogue: scene.dialogue,
            voiceCharacterId,
            durationSeconds: scene.durationSeconds,
          }
          if (characterAnglesUrlForVideo) {
            videoBody.characterAnglesUrl = characterAnglesUrlForVideo
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
            get().updateScene(scene.id, { status: 'error' })
            continue
          }

          get().updateScene(scene.id, {
            videoUrl: videoJson.videoUrl,
            status: 'video_ready',
          })
        } catch (videoErr) {
          console.error('generate-video exception:', videoErr)
          get().updateScene(scene.id, { status: 'error' })
        }
      }
    } catch (err) {
      console.error('startGeneration:', err)
      set({ project: null })
    }
  },

  currentTab: 'script',
  setCurrentTab: (tab) => set({ currentTab: tab }),

  hasStarted: false,
  setHasStarted: (started) => set({ hasStarted: started }),
}))
