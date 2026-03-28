/**
 * Veo 3.1 only allows 4, 6, or 8 second clips (not every integer from 4–8).
 * @see https://ai.google.dev/gemini-api/docs/video#veo-api-parameters-and-specifications
 */
export function snapVeo31DurationSeconds(raw: number): 4 | 6 | 8 {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return 6
  const clamped = Math.max(4, Math.min(8, n))
  if (clamped <= 4) return 4
  if (clamped <= 5) return 6
  if (clamped <= 6) return 6
  if (clamped <= 7) return 6
  return 8
}
