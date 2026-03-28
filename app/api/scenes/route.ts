import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { countWords } from '@/lib/validate-script'
import { normalizeSceneDurationSeconds } from '@/lib/veo-duration'
import type { Scene } from '@/lib/types'

const bodySchema = z.object({
  projectId: z.string().uuid(),
  order: z.number().int().min(1),
  dialogue: z.string().default(''),
  visualPrompt: z.string().default(''),
  thumbnailPrompt: z.string().optional(),
  sceneType: z.enum(['avatar_present', 'broll', 'mixed']).default('mixed'),
  durationSeconds: z.coerce.number().min(4).max(8).default(6),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body: projectId, order, optional dialogue/visualPrompt/durationSeconds' },
      { status: 400 },
    )
  }

  const {
    projectId,
    order,
    dialogue,
    visualPrompt,
    thumbnailPrompt,
    sceneType,
    durationSeconds,
  } = parsed.data

  const vp = visualPrompt.trim() || 'Scene visual description.'
  const thumbP = (thumbnailPrompt ?? vp).trim()
  const dur = normalizeSceneDurationSeconds(durationSeconds)

  const supabase = createServerClient()

  const { data: row, error } = await supabase
    .from('scenes')
    .insert({
      project_id: projectId,
      order,
      dialogue,
      word_count: countWords(dialogue),
      visual_prompt: vp,
      scene_type: sceneType,
      duration_seconds: dur,
      status: 'pending',
    })
    .select(
      'id, order, dialogue, word_count, visual_prompt, scene_type, duration_seconds, thumbnail_url, video_url, status',
    )
    .single()

  if (error || !row) {
    console.error('POST /api/scenes', error)
    return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 })
  }

  const scene: Scene = {
    id: row.id as string,
    order: row.order as number,
    sceneType: row.scene_type as Scene['sceneType'],
    dialogue: row.dialogue as string,
    wordCount: row.word_count as number,
    durationSeconds: normalizeSceneDurationSeconds(Number(row.duration_seconds ?? 8)),
    visualPrompt: vp,
    thumbnailPrompt: thumbP,
    scriptHtml: dialogue,
    confirmed: false,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    videoUrl: (row.video_url as string | null) ?? null,
    status: row.status as Scene['status'],
  }

  return NextResponse.json({ scene })
}
