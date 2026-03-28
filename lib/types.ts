// ─── Enums / Union Types ────────────────────────────────────────────────────

export type AvatarType = 'none' | 'default_male' | 'default_female' | 'custom'
export type SceneType = 'avatar_present' | 'broll' | 'mixed'

export type TargetAgeBand = 'preschool' | 'kindergarten' | 'primary'

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
  | 'video_ready'
  | 'complete'
  | 'error'

/** Multi-stage approval pipeline (drafting table → gallery). */
export type ProjectStage =
  | 'setup'
  | 'script_approval'
  | 'thumbnail_approval'
  | 'video_approval'
  | 'final'

// ─── Core Domain Types ──────────────────────────────────────────────────────

export interface Scene {
  id: string
  order: number
  sceneType: SceneType
  dialogue: string
  wordCount: number
  /** Scene clip length in seconds (≤8). Drives proportional dialogue cap. */
  durationSeconds: number
  visualPrompt: string
  /** Editable thumbnail / keyframe prompt (defaults to visualPrompt). */
  thumbnailPrompt: string
  /** Editable narration/script (HTML or plain text; synced to dialogue on confirm). */
  scriptHtml: string
  /** When true, scene appears in the right-hand gallery. */
  confirmed: boolean
  thumbnailUrl: string | null
  videoUrl: string | null
  status: SceneStatus
}

export interface Project {
  id: string
  sessionId: string
  status: ProjectStatus
  /** Controls left-pane drafting vs approval steps. */
  stage: ProjectStage
  lessonPrompt: string
  pdfUrl: string | null
  avatarType: AvatarType
  voiceCharacterId: string
  characterAnglesUrl: string | null
  script: GeminiScriptOutput | null
  scenes: Scene[]
  musicUrl: string | null
  finalVideoUrl: string | null
}

export interface LessonData {
  lessonPrompt: string
  uploadedFile: string | null
  uploadedFileUrl: string | null
  duration: number
  targetAge: TargetAgeBand
}

// ─── Gemini Director Output ─────────────────────────────────────────────────

export interface GeminiScriptOutput {
  title: string
  targetAge: string
  artStyle: 'pixar_3d' | 'disney_junior' | 'watercolor_storybook'
  voiceCharacterId: string
  musicMood: string
  scenes: GeminiRawScene[]
}

export interface GeminiRawScene {
  order: number
  sceneType: SceneType
  dialogue: string
  visualPrompt: string
  /** Seconds for this scene (1–8). Sum across scenes must equal target video length. */
  durationSeconds: number
}

// ─── API Request / Response Types ───────────────────────────────────────────

export interface GenerateScriptRequest {
  lessonPrompt: string
  pdfUrl?: string
  avatarType: AvatarType
  voiceCharacterId: string
  targetAge: TargetAgeBand
  /** Total output video length in seconds (e.g. 15–60). Director splits across scenes. */
  targetDurationSeconds: number
}

export interface GenerateScriptResponse {
  projectId: string
  script: GeminiScriptOutput
  scenes: Scene[]
}

export interface GenerateThumbnailRequest {
  sceneId: string
  projectId: string
  visualPrompt: string
  artStyle: GeminiScriptOutput['artStyle']
  characterAnglesUrl?: string
}

export interface GenerateThumbnailResponse {
  thumbnailUrl: string
}

export interface GenerateVideoRequest {
  sceneId: string
  projectId: string
  thumbnailUrl: string
  visualPrompt: string
  dialogue: string
  voiceCharacterId: string
  durationSeconds: number
  characterAnglesUrl?: string
}

export interface GenerateVideoResponse {
  videoUrl: string
}

export interface StitchVideoRequest {
  projectId: string
  sceneVideoUrls: string[]
  musicUrl: string
}

export interface StitchVideoResponse {
  finalVideoUrl: string
}
