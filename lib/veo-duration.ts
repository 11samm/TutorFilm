import type { GeminiScriptOutput } from './types'

/**
 * Veo 3.1 only allows 4, 6, or 8 second clips (not every integer from 4–8).
 * The pipeline treats these as the only legal scene durations end-to-end.
 *
 * Use {@link snapVeo31DurationSeconds} / {@link normalizeSceneDurationSeconds} as the
 * final catch-all before any database write or Veo API call so values never leave
 * this set unexpectedly.
 *
 * @see https://ai.google.dev/gemini-api/docs/video#veo-api-parameters-and-specifications
 */
export const VEO_CLIP_SECONDS = [4, 6, 8] as const

export type VeoClipSeconds = (typeof VEO_CLIP_SECONDS)[number]

export function isAllowedVeoClipSeconds(n: number): n is VeoClipSeconds {
  return (VEO_CLIP_SECONDS as readonly number[]).includes(n)
}

/**
 * Maps any numeric input to the nearest allowed Veo clip length in 4–8s (4, 6, or 8).
 */
export function snapVeo31DurationSeconds(raw: number): VeoClipSeconds {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 6
  const clamped = Math.max(4, Math.min(8, n))
  if (clamped <= 4) return 4
  if (clamped <= 5) return 6
  if (clamped <= 6) return 6
  if (clamped <= 7) return 6
  return 8
}

/**
 * Final normalization before persistence or calling Veo — always snap through here.
 */
export function normalizeSceneDurationSeconds(raw: number): VeoClipSeconds {
  return snapVeo31DurationSeconds(raw)
}

/** Applies {@link snapVeo31DurationSeconds} to every scene before DB save or downstream APIs. */
export function snapDurationsInScript(script: GeminiScriptOutput): GeminiScriptOutput {
  return {
    ...script,
    scenes: script.scenes.map((s) => ({
      ...s,
      durationSeconds: snapVeo31DurationSeconds(s.durationSeconds),
    })),
  }
}
