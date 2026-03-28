import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { buildVoicePrompt } from '@/lib/voice-catalog'
import type { GenerateVideoRequest, GenerateVideoResponse } from '@/lib/types'

const VIDEO_MODEL = 'veo-2.0-generate-preview'
const VIDEOS_BUCKET = 'videos'

async function fetchThumbnailAsImageBytes(
  thumbnailUrl: string
): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    const res = await fetch(thumbnailUrl)
    if (!res.ok) {
      console.warn('Thumbnail fetch failed:', res.status)
      return null
    }
    const buf = await res.arrayBuffer()
    const imageBytes = Buffer.from(buf).toString('base64')
    const mimeType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    return { imageBytes, mimeType }
  } catch (e) {
    console.warn('Thumbnail fetch error:', e)
    return null
  }
}

function extractVideoBuffer(op: {
  response?: {
    generatedVideos?: Array<{ video?: { videoBytes?: string; uri?: string; mimeType?: string } }>
  }
}): { buffer: Buffer; mimeType: string } | null {
  const video = op.response?.generatedVideos?.[0]?.video
  if (!video) return null
  if (video.videoBytes) {
    return {
      buffer: Buffer.from(video.videoBytes, 'base64'),
      mimeType: video.mimeType?.trim() || 'video/mp4',
    }
  }
  if (video.uri?.startsWith('http')) {
    return null
  }
  return null
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Expected JSON object' }, { status: 400 })
  }

  const b = body as Partial<GenerateVideoRequest>
  if (
    typeof b.sceneId !== 'string' ||
    typeof b.projectId !== 'string' ||
    typeof b.thumbnailUrl !== 'string' ||
    typeof b.visualPrompt !== 'string' ||
    typeof b.dialogue !== 'string' ||
    typeof b.voiceCharacterId !== 'string' ||
    typeof b.durationSeconds !== 'number' ||
    !Number.isFinite(b.durationSeconds)
  ) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid fields: sceneId, projectId, thumbnailUrl, visualPrompt, dialogue, voiceCharacterId, durationSeconds',
      },
      { status: 400 }
    )
  }

  const req: GenerateVideoRequest = {
    sceneId: b.sceneId,
    projectId: b.projectId,
    thumbnailUrl: b.thumbnailUrl,
    visualPrompt: b.visualPrompt,
    dialogue: b.dialogue,
    voiceCharacterId: b.voiceCharacterId,
    durationSeconds: b.durationSeconds,
    characterAnglesUrl: typeof b.characterAnglesUrl === 'string' ? b.characterAnglesUrl : undefined,
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set' }, { status: 500 })
  }

  const supabase = createServerClient()

  const { error: statusErr } = await supabase
    .from('scenes')
    .update({ status: 'video_generating' })
    .eq('id', req.sceneId)

  if (statusErr) {
    console.error('generate-video: status update', statusErr)
    return NextResponse.json({ error: statusErr.message }, { status: 500 })
  }

  const thumb = await fetchThumbnailAsImageBytes(req.thumbnailUrl)
  if (!thumb) {
    await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
    return NextResponse.json({ error: 'Failed to load thumbnail image' }, { status: 502 })
  }

  const voiceLine = buildVoicePrompt(req.voiceCharacterId, req.dialogue)
  const prompt = `${req.visualPrompt}\n\n${voiceLine}`

  const clipSeconds = Math.min(8, Math.max(1, Math.round(req.durationSeconds)))

  const ai = new GoogleGenAI({ apiKey })

  try {
    let operation = await ai.models.generateVideos({
      model: VIDEO_MODEL,
      source: {
        prompt,
        image: {
          imageBytes: thumb.imageBytes,
          mimeType: thumb.mimeType,
        },
      },
      config: {
        numberOfVideos: 1,
        aspectRatio: '16:9',
        durationSeconds: clipSeconds,
      },
    })

    const maxPolls = 120
    let polls = 0
    while (!operation.done && polls < maxPolls) {
      await new Promise((r) => setTimeout(r, 5000))
      operation = await ai.operations.getVideosOperation({ operation })
      polls += 1
    }

    if (!operation.done) {
      await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
      return NextResponse.json({ error: 'Video generation timed out' }, { status: 504 })
    }

    let extracted = extractVideoBuffer(operation as Parameters<typeof extractVideoBuffer>[0])
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri

    if (!extracted && videoUri?.startsWith('http')) {
      const vidRes = await fetch(videoUri)
      if (!vidRes.ok) {
        await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
        return NextResponse.json({ error: 'Failed to download generated video' }, { status: 502 })
      }
      const ab = await vidRes.arrayBuffer()
      extracted = {
        buffer: Buffer.from(ab),
        mimeType: vidRes.headers.get('content-type')?.split(';')[0]?.trim() || 'video/mp4',
      }
    }

    if (!extracted) {
      await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
      return NextResponse.json({ error: 'No video data in response' }, { status: 502 })
    }

    const path = `${req.projectId}/${req.sceneId}.mp4`
    const { error: uploadError } = await supabase.storage.from(VIDEOS_BUCKET).upload(path, extracted.buffer, {
      contentType: extracted.mimeType.includes('mp4') ? 'video/mp4' : extracted.mimeType,
      upsert: true,
    })

    if (uploadError) {
      console.error('generate-video: storage upload', uploadError)
      await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(path)

    const { error: finalErr } = await supabase
      .from('scenes')
      .update({ video_url: publicUrl, status: 'video_ready' })
      .eq('id', req.sceneId)

    if (finalErr) {
      console.error('generate-video: scene update', finalErr)
      return NextResponse.json({ error: finalErr.message }, { status: 500 })
    }

    const payload: GenerateVideoResponse = { videoUrl: publicUrl }
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('generate-video:', err)
    await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
