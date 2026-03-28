import type { GeminiScriptOutput } from '@/lib/types'

/** Public placeholders — no AI credits. */
export const MOCK_IMAGE_URL = (sceneOrder: number) =>
  `https://picsum.photos/seed/tutorfilm-mock-${sceneOrder}/800/450`

/** Short CC0 sample (MDN). */
export const MOCK_SCENE_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

/** Same file as assembled master for dev UX. */
export const MOCK_ASSEMBLED_VIDEO_URL = MOCK_SCENE_VIDEO_URL

/** Public sample MP3. */
export const MOCK_MUSIC_URL =
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

/** Final mux output — reuse sample MP4 for UI testing. */
export const MOCK_FINAL_VIDEO_URL = MOCK_SCENE_VIDEO_URL

export type MockProjectStage =
  | 'script_approval'
  | 'thumbnail_approval'
  | 'video_approval'
  | 'final'

export function buildMockScriptJson(): GeminiScriptOutput {
  return {
    title: '[Mock] Dev UI Test Lesson',
    targetAge: 'primary',
    artStyle: 'pixar_3d',
    voiceCharacterId: 'raspy_lumberjack',
    musicMood: 'calm, curious, educational',
    scenes: [
      {
        order: 1,
        sceneType: 'avatar_present',
        dialogue:
          'Welcome to this mock lesson. We are testing the interface without spending API credits.',
        visualPrompt: 'A friendly animated teacher in a bright classroom, mock placeholder.',
        durationSeconds: 6,
      },
      {
        order: 2,
        sceneType: 'broll',
        dialogue: 'Here is a second scene with sample narration for layout checks.',
        visualPrompt: 'Simple outdoor illustration, soft colors, educational tone.',
        durationSeconds: 6,
      },
      {
        order: 3,
        sceneType: 'mixed',
        dialogue: 'And a third scene to fill the drafting table scroll area.',
        visualPrompt: 'Abstract shapes and numbers floating gently, kid friendly.',
        durationSeconds: 6,
      },
    ],
  }
}
