import { z } from 'zod'

/**
 * Per-scene duration for the director script. Veo 3.1 only allows 4, 6, or 8 seconds.
 */
export const durationSecondsSchema = z
  .number()
  .int()
  .min(4)
  .max(8)
  .refine((n) => n % 2 === 0, {
    message: 'Duration must be an even number (4, 6, or 8)',
  })

export const geminiScriptOutputSchema = z.object({
  title: z.string(),
  targetAge: z.string(),
  artStyle: z.enum(['pixar_3d', 'disney_junior', 'watercolor_storybook']),
  voiceCharacterId: z.string(),
  musicMood: z.string(),
  scenes: z
    .array(
      z.object({
        order: z.number().int().positive(),
        sceneType: z.enum(['avatar_present', 'broll', 'mixed']),
        dialogue: z.string(),
        visualPrompt: z.string(),
        durationSeconds: durationSecondsSchema,
      })
    )
    .min(1)
    .max(48),
})

export type GeminiScriptOutputParsed = z.infer<typeof geminiScriptOutputSchema>
