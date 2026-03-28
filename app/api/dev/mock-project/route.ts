import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { countWords } from '@/lib/validate-script'
import {
  buildMockScriptJson,
  MOCK_ASSEMBLED_VIDEO_URL,
  MOCK_FINAL_VIDEO_URL,
  MOCK_IMAGE_URL,
  MOCK_MUSIC_URL,
  MOCK_SCENE_VIDEO_URL,
} from '@/lib/mock-data'
import type { AvatarType, GeminiScriptOutput, Project, ProjectStatus, ProjectStage, Scene } from '@/lib/types'
import { normalizeSceneDurationSeconds } from '@/lib/veo-duration'

const stageSchema = z.enum(['script_approval', 'thumbnail_approval', 'video_approval', 'final'])

function mapClientStage(stage: 'script_approval' | 'thumbnail_approval' | 'video_approval' | 'final'): ProjectStage {
  if (stage === 'final') return 'final'
  return stage
}

function mapClientStatus(stage: 'script_approval' | 'thumbnail_approval' | 'video_approval' | 'final'): ProjectStatus {
  if (stage === 'final') return 'complete'
  return 'idle'
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = z.object({ stage: stageSchema }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body must include stage' }, { status: 400 })
  }

  const { stage } = parsed.data
  const script = buildMockScriptJson()
  const supabase = createServerClient()
  const sessionId = crypto.randomUUID()

  const { data: projectRow, error: projectError } = await supabase
    .from('projects')
    .insert({
      session_id: sessionId,
      status: 'idle',
      lesson_prompt: '[Mock] Dev UI test — no API generation',
      pdf_url: null,
      avatar_type: 'default_male',
      voice_character_id: 'raspy_lumberjack',
      character_angles_url: null,
      script_json: script as unknown as Record<string, unknown>,
      music_url: null,
      assembled_scenes_video_url: null,
      final_video_url: null,
    })
    .select('id')
    .single()

  if (projectError || !projectRow?.id) {
    console.error('mock-project insert project', projectError)
    return NextResponse.json(
      { error: projectError?.message ?? 'Failed to create mock project' },
      { status: 500 },
    )
  }

  const projectId = projectRow.id as string

  const sceneInserts = script.scenes.map((s) => {
    const thumb =
      stage === 'script_approval'
        ? null
        : MOCK_IMAGE_URL(s.order)
    const vid =
      stage === 'script_approval' || stage === 'thumbnail_approval'
        ? null
        : MOCK_SCENE_VIDEO_URL

    let st: Scene['status'] = 'pending'
    if (stage === 'script_approval') st = 'pending'
    else if (stage === 'thumbnail_approval') st = 'thumbnail_ready'
    else st = 'video_ready'

    return {
      project_id: projectId,
      order: s.order,
      dialogue: s.dialogue,
      word_count: countWords(s.dialogue),
      visual_prompt: s.visualPrompt,
      scene_type: s.sceneType,
      duration_seconds: normalizeSceneDurationSeconds(s.durationSeconds),
      thumbnail_url: thumb,
      video_url: vid,
      status: st,
    }
  })

  const { data: sceneRows, error: scenesError } = await supabase
    .from('scenes')
    .insert(sceneInserts)
    .select(
      'id, order, dialogue, word_count, visual_prompt, scene_type, duration_seconds, thumbnail_url, video_url, status',
    )

  if (scenesError || !sceneRows?.length) {
    console.error('mock-project insert scenes', scenesError)
    await supabase.from('projects').delete().eq('id', projectId)
    return NextResponse.json(
      { error: scenesError?.message ?? 'Failed to insert mock scenes' },
      { status: 500 },
    )
  }

  sceneRows.sort((a, b) => (a.order as number) - (b.order as number))

  let musicUrl: string | null = null
  let assembledUrl: string | null = null
  let finalUrl: string | null = null

  if (stage === 'final') {
    musicUrl = MOCK_MUSIC_URL
    assembledUrl = MOCK_ASSEMBLED_VIDEO_URL
    finalUrl = MOCK_FINAL_VIDEO_URL
    const { error: updErr } = await supabase
      .from('projects')
      .update({
        music_url: musicUrl,
        assembled_scenes_video_url: assembledUrl,
        final_video_url: finalUrl,
        status: 'complete',
      })
      .eq('id', projectId)
    if (updErr) {
      console.warn('mock-project project update', updErr.message)
    }
  }

  const confirmedScenes = stage !== 'script_approval'

  const scenes: Scene[] = sceneRows.map((row) => {
    const dialogue = row.dialogue as string
    const visualPrompt = row.visual_prompt as string
    return {
      id: row.id as string,
      order: row.order as number,
      sceneType: row.scene_type as Scene['sceneType'],
      dialogue,
      wordCount: row.word_count as number,
      durationSeconds: normalizeSceneDurationSeconds(Number(row.duration_seconds ?? 8)),
      visualPrompt,
      thumbnailPrompt: visualPrompt,
      scriptHtml: dialogue,
      confirmed: confirmedScenes,
      thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
      videoUrl: (row.video_url as string | null) ?? null,
      status: parseSceneStatus(row.status),
    }
  })

  const projectStage = mapClientStage(stage)
  const projectStatus = mapClientStatus(stage)

  const project: Project = {
    id: projectId,
    sessionId,
    status: projectStatus,
    stage: projectStage,
    lessonPrompt: '[Mock] Dev UI test — no API generation',
    pdfUrl: null,
    avatarType: 'default_male' as AvatarType,
    voiceCharacterId: 'raspy_lumberjack',
    characterAnglesUrl: null,
    script: script as GeminiScriptOutput,
    scenes,
    musicUrl,
    assembledScenesVideoUrl: assembledUrl,
    finalVideoUrl: finalUrl,
  }

  const totalDuration = scenes.reduce((acc, s) => acc + s.durationSeconds, 0)

  return NextResponse.json({
    project,
    lessonData: {
      lessonPrompt: project.lessonPrompt,
      uploadedFile: null,
      uploadedFileUrl: null,
      duration: totalDuration > 0 ? totalDuration : 30,
      targetAge: 'primary' as const,
    },
    currentTab:
      stage === 'script_approval'
        ? 'script'
        : stage === 'thumbnail_approval'
          ? 'thumbnails'
          : stage === 'video_approval'
            ? 'videos'
            : 'final',
  })
}

function parseSceneStatus(raw: unknown): Scene['status'] {
  const s = typeof raw === 'string' ? raw : ''
  const allowed: Scene['status'][] = [
    'pending',
    'thumbnail_generating',
    'thumbnail_ready',
    'video_generating',
    'video_ready',
    'complete',
    'error',
  ]
  return allowed.includes(s as Scene['status']) ? (s as Scene['status']) : 'pending'
}
