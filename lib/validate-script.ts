import type { GeminiRawScene } from './types'

/** 20 words per 8 seconds → 2.5 words per second (strict drafting-table cap). */
export const WORDS_PER_SECOND = 2.5

export function countWords(text: string): number {
  return text
    .trim()
    .replace(/[^\w\s']/g, '')
    .split(/\s+/)
    .filter(Boolean).length
}

/**
 * Max narration words for a scene at 2.5 words/sec.
 * Examples: 4s → 10, 6s → 15, 8s → 20.
 */
export function maxWordsForScene(durationSeconds: number): number {
  return Math.max(0, Math.floor(durationSeconds * WORDS_PER_SECOND))
}

/** Maps narration length to allowed clip durations (4 / 6 / 8 seconds). */
export function calculateDurationFromWordCount(wordCount: number): number {
  if (wordCount <= 10) return 4
  if (wordCount > 10 && wordCount <= 15) return 6
  return 8
}

/** Truncate plain text to at most `maxWords` words (typing/paste enforcement). */
export function clampNarrationToWordLimit(text: string, maxWords: number): string {
  if (maxWords <= 0) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ')
}

/** Badge tone for current vs max word count (UI). */
export function narrationWordBadgeTone(
  current: number,
  max: number
): 'safe' | 'warn' | 'max' {
  if (max <= 0) return 'safe'
  if (current >= max) return 'max'
  if (current > max * 0.85) return 'warn'
  return 'safe'
}

export type SceneViolation = {
  order: number
  wordCount: number
  maxWords: number
  durationSeconds: number
  reason: string
}

export function validateScenes(scenes: GeminiRawScene[]): {
  valid: boolean
  violations: SceneViolation[]
} {
  const violations: SceneViolation[] = []

  for (const s of scenes) {
    const wordCount = countWords(s.dialogue)
    const maxWords = maxWordsForScene(s.durationSeconds)

    if (![4, 6, 8].includes(s.durationSeconds)) {
      violations.push({
        order: s.order,
        wordCount,
        maxWords,
        durationSeconds: s.durationSeconds,
        reason: 'durationSeconds must be exactly 4, 6, or 8 (even seconds only)',
      })
      continue
    }

    if (wordCount > maxWords) {
      violations.push({
        order: s.order,
        wordCount,
        maxWords,
        durationSeconds: s.durationSeconds,
        reason: `dialogue exceeds max ${maxWords} words for ${s.durationSeconds}s scene (~2.5 words/sec)`,
      })
    }
  }

  return { valid: violations.length === 0, violations }
}

export function validateDurationBudget(
  scenes: GeminiRawScene[],
  targetDurationSeconds: number
): { valid: boolean; sum: number } {
  const sum = scenes.reduce((acc, s) => acc + s.durationSeconds, 0)
  return { valid: sum === targetDurationSeconds, sum }
}
