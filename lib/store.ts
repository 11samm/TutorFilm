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
  setLessonData: (data) => set({ lessonData: data }),

  avatarType: 'none',
  setAvatarType: (avatarType) => set({ avatarType }),

  voiceCharacterId: 'woodland_gnome_scholar',
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
        characterAnglesUrl: null,
      },
    })

    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonPrompt: lessonData.lessonPrompt,
          pdfUrl: lessonData.uploadedFileUrl ?? undefined,
          targetDurationMinutes: lessonData.duration / 60,
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
          characterAnglesUrl: null,
        },
        currentTab: 'script',
      })
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
