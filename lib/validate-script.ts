import type { GeminiRawScene } from './types'

export function countWords(text: string): number {
  return text
    .trim()
    .replace(/[^\w\s']/g, '')
    .split(/\s+/)
    .filter(Boolean).length
}

/** Max dialogue words allowed for a scene of `durationSeconds` at ~2.5 words/sec. */
export function maxWordsForScene(durationSeconds: number): number {
  return Math.floor(durationSeconds * 2.5)
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

    if (s.durationSeconds > 8) {
      violations.push({
        order: s.order,
        wordCount,
        maxWords,
        durationSeconds: s.durationSeconds,
        reason: 'durationSeconds must be at most 8',
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
