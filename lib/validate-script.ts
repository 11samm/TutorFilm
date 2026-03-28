import type { GeminiRawScene } from './types'

export function countWords(text: string): number {
  return text
    .trim()
    .replace(/[^\w\s']/g, '')
    .split(/\s+/)
    .filter(Boolean).length
}

export function validateScenes(scenes: GeminiRawScene[]): {
  valid: boolean
  violations: Array<{ order: number; wordCount: number }>
} {
  const violations = scenes
    .map((s) => ({ order: s.order, wordCount: countWords(s.dialogue) }))
    .filter((s) => s.wordCount > 20)
  return { valid: violations.length === 0, violations }
}
