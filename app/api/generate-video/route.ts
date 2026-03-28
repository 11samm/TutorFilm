import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { snapVeo31DurationSeconds } from '@/lib/veo-duration'
import { buildVoicePrompt } from '@/lib/voice-catalog'
import type { GenerateVideoRequest, GenerateVideoResponse } from '@/lib/types'

const VIDEO_MODEL = 'veo-3.1-generate-preview'
const VIDEOS_BUCKET = 'videos'
const GENAI_BASE = 'https://generativelanguage.googleapis.com'

/** Same key family as Gemini; prefer GOOGLE_API_KEY when set (raw REST URLs). */
function googleApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY
}

/** Raw base64 (no data URL prefix) for the Veo image field. */
async function fetchThumbnailForVeo(
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

/** Raw LRO from generativelanguage.googleapis.com (generateVideoResponse path). */
function extractVideoBufferFromRawOperation(op: unknown): { buffer: Buffer; mimeType: string } | null {
  const o = op as {
    response?: {
      generateVideoResponse?: {
        generatedSamples?: Array<{
          video?: { encodedVideo?: string; uri?: string; encoding?: string }
        }>
      }
    }
  }
  const video = o.response?.generateVideoResponse?.generatedSamples?.[0]?.video
  if (!video) return null
  if (video.encodedVideo) {
    return {
      buffer: Buffer.from(video.encodedVideo, 'base64'),
      mimeType: video.encoding?.trim() || 'video/mp4',
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

  const apiKey = googleApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: GOOGLE_API_KEY or GEMINI_API_KEY is not set' },
      { status: 500 }
    )
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

  const thumb = await fetchThumbnailForVeo(req.thumbnailUrl)
  if (!thumb) {
    await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
    return NextResponse.json({ error: 'Failed to load thumbnail image' }, { status: 502 })
  }

  const voiceLine = buildVoicePrompt(req.voiceCharacterId, req.dialogue)
  const prompt = `${req.visualPrompt}\n\n${voiceLine}`

  const safeDuration = snapVeo31DurationSeconds(
    Number.isFinite(req.durationSeconds) ? req.durationSeconds : 6
  )

  try {
    console.log('=== VEO API PAYLOAD CHECK ===')
    console.log(
      'Raw req duration:',
      req.durationSeconds,
      '| Clamped safeDuration:',
      safeDuration
    )
    console.log('Sending Veo Request | Duration:', safeDuration)

    /**
     * Gemini REST `predictLongRunning` expects `instances` + `parameters` (not top-level `config`).
     * Image uses `bytesBase64Encoded` per API (SDK maps imageBytes → this field).
     * @see @google/genai generateVideosParametersToMldev / imageToMldev
     */
    const parameters = {
      durationSeconds: safeDuration,
      aspectRatio: "16:9",
    }

    console.log('DEBUG: Sending parameters:', JSON.stringify(parameters, null, 2))

    const predictBody = {
      instances: [
        {
          prompt,
          image: {
            bytesBase64Encoded: thumb.imageBytes,
            mimeType: thumb.mimeType,
          },
        },
      ],
      parameters,
    }

    const startUrl = `${GENAI_BASE}/v1beta/models/${VIDEO_MODEL}:predictLongRunning?key=${encodeURIComponent(apiKey)}`

    const startRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(predictBody),
    })

    const startJson = (await startRes.json()) as { name?: string; error?: unknown }
    if (!startRes.ok) {
      console.error('generate-video: predictLongRunning failed', startRes.status, startJson)
      const msg =
        typeof startJson.error === 'object' && startJson.error !== null && 'message' in startJson.error
          ? String((startJson.error as { message?: string }).message)
          : JSON.stringify(startJson.error ?? startJson)
      throw new Error(msg || `predictLongRunning ${startRes.status}`)
    }

    const operationName = startJson.name
    if (!operationName) {
      throw new Error('predictLongRunning: missing operation name')
    }

    const pollUrl = `${GENAI_BASE}/v1beta/${operationName}?key=${encodeURIComponent(apiKey)}`

    const maxPolls = 120
    let polls = 0
    let operation: unknown = null

    while (polls < maxPolls) {
      const pollRes = await fetch(pollUrl, { method: 'GET' })
      operation = await pollRes.json()
      if (!pollRes.ok) {
        console.error('generate-video: poll operation failed', pollRes.status, operation)
        throw new Error(
          typeof operation === 'object' && operation !== null && 'error' in operation
            ? JSON.stringify((operation as { error: unknown }).error)
            : `poll ${pollRes.status}`
        )
      }

      const done = (operation as { done?: boolean }).done
      const err = (operation as { error?: { message?: string } }).error
      if (err) {
        throw new Error(err.message ?? JSON.stringify(err))
      }
      if (done) break

      await new Promise((r) => setTimeout(r, 5000))
      polls += 1
    }

    if (!(operation as { done?: boolean })?.done) {
      await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
      return NextResponse.json({ error: 'Video generation timed out' }, { status: 504 })
    }

    let extracted = extractVideoBufferFromRawOperation(operation)
    const videoUri = (
      operation as {
        response?: { generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> } }
      }
    ).response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri

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
