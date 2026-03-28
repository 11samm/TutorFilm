// ─── Enums / Union Types ────────────────────────────────────────────────────

export type AvatarType = 'none' | 'default_male' | 'default_female' | 'custom'
export type SceneType = 'avatar_present' | 'broll' | 'mixed'

export type ProjectStatus =
  | 'idle'
  | 'scripting'
  | 'generating_assets'
  | 'generating_videos'
  | 'composing_music'
  | 'stitching'
  | 'complete'
  | 'error'

export type SceneStatus =
  | 'pending'
  | 'thumbnail_generating'
  | 'thumbnail_ready'
  | 'video_generating'
  | 'complete'
  | 'error'

// ─── Core Domain Types ──────────────────────────────────────────────────────

export interface Scene {
  id: string
  order: number
  sceneType: SceneType
  dialogue: string // HARD LIMIT: ≤20 words — enforced server-side before DB insert
  wordCount: number
  visualPrompt: string // passed to Nano Banana 2 for thumbnail generation
  thumbnailUrl: string | null
  videoUrl: string | null
  status: SceneStatus
}

export interface Project {
  id: string
  sessionId: string
  status: ProjectStatus
  lessonPrompt: string
  pdfUrl: string | null
  avatarType: AvatarType
  voiceCharacterId: string // key into VOICE_CATALOG
  characterAnglesUrl: string | null // Nano Banana 2 4-angle sheet output URL
  script: GeminiScriptOutput | null
  scenes: Scene[]
  musicUrl: string | null
  finalVideoUrl: string | null
}

export interface LessonData {
  lessonPrompt: string
  uploadedFile: string | null // display name only (e.g. "chapter3.pdf")
  uploadedFileUrl: string | null // Supabase Storage public URL
  duration: number // target minutes → used to calculate scene count
}

// ─── Gemini Director Output ─────────────────────────────────────────────────

export interface GeminiScriptOutput {
  title: string
  targetAge: string // e.g. "5-8"
  artStyle: 'pixar_3d' | 'disney_junior' | 'watercolor_storybook'
  voiceCharacterId: string // must be a valid key from VOICE_CATALOG
  musicMood: string // e.g. "adventurous, orchestral, childlike wonder"
  scenes: GeminiRawScene[]
}

export interface GeminiRawScene {
  order: number
  sceneType: SceneType
  dialogue: string // Gemini is prompted to keep this ≤20 words
  visualPrompt: string // detailed Pixar/Disney art direction prompt
}

// ─── API Request / Response Types ───────────────────────────────────────────

export interface GenerateScriptRequest {
  lessonPrompt: string
  pdfUrl?: string
  avatarType: AvatarType
  voiceCharacterId: string
  targetDurationMinutes: number
}

export interface GenerateScriptResponse {
  projectId: string
  script: GeminiScriptOutput
  scenes: Scene[]
}

export interface GenerateVideoRequest {
  sceneId: string
  projectId: string
  thumbnailUrl: string
  visualPrompt: string
  dialogue: string
  voiceCharacterId: string
  characterAnglesUrl?: string
}

export interface GenerateVideoResponse {
  videoUrl: string
}

export interface StitchVideoRequest {
  projectId: string
  sceneVideoUrls: string[] // ordered array
  musicUrl: string
}

export interface StitchVideoResponse {
  finalVideoUrl: string
}
