import { GoogleGenAI, type GenerateContentResponse } from '@google/genai'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'

export const maxDuration = 120

const MUSIC_BUCKET = 'music'

/**
 * Lyria 3 — use published Gemini model ids (`lyria-3` alone is not valid).
 * @see https://ai.google.dev/gemini-api/docs/music-generation
 */
function lyriaModelForRequest(durationSeconds: number): string {
  const fromEnv = process.env.LYRIA_MODEL?.trim()
  if (fromEnv) return fromEnv
  return durationSeconds <= 30 ? 'lyria-3-clip-preview' : 'lyria-3-pro-preview'
}

function googleApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? process.env.LYRIA_API_KEY
}

function extensionForMime(mime: string | undefined): string {
  const m = (mime ?? '').toLowerCase()
  if (m.includes('wav')) return 'wav'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  return 'mp3'
}

function extractAudioFromResponse(response: {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> } }>
}): { buffer: Buffer; mimeType: string } | null {
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts?.length) return null

  for (const p of parts) {
    const data = p.inlineData?.data
    if (!data) continue
    const mimeType = p.inlineData?.mimeType ?? 'audio/mpeg'
    if (mimeType.startsWith('audio/') || mimeType.includes('mpeg')) {
      return { buffer: Buffer.from(data, 'base64'), mimeType }
    }
  }

  for (const p of parts) {
    const data = p.inlineData?.data
    if (data) {
      return {
        buffer: Buffer.from(data, 'base64'),
        mimeType: p.inlineData?.mimeType ?? 'audio/mpeg',
      }
    }
  }
  return null
}

const bodySchema = z.object({
  projectId: z.string().uuid(),
  musicMood: z.string().min(1),
  durationSeconds: z.coerce.number().positive().max(600),
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
      { error: 'Invalid body: projectId (uuid), musicMood (non-empty), durationSeconds (1–600) required' },
      { status: 400 },
    )
  }

  const { projectId, musicMood, durationSeconds } = parsed.data
  const apiKey = googleApiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_API_KEY, GEMINI_API_KEY, or LYRIA_API_KEY' },
      { status: 500 },
    )
  }

  const prompt = [
    'Generate ONLY a non-vocal instrumental underscore for a narrated educational video — not a song with verses, not a lead melody that competes with speech.',
    'Use soft ambient pads, light electronic rhythm, gentle piano or strings, or sparse orchestral texture. Library-music / production-bed style; no featured soloist.',
    `Mood: ${musicMood}.`,
    `Target length about ${Math.round(durationSeconds)} seconds. Keep dynamics gentle and below a spoken voiceover — no loud peaks.`,
    'CRITICAL: pure instrumental audio only. No singing, humming, chanting, choir, rap, beatboxing, spoken word, mumbled syllables, fake language, or any human-like vocal sounds. No vocoder or voice-like synth leads.',
  ].join(' ')

  const ai = new GoogleGenAI({ apiKey })
  const model = lyriaModelForRequest(durationSeconds)

  let response: GenerateContentResponse
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseModalities: ['AUDIO'],
        systemInstruction:
          'You generate only instrumental underscore audio for educational video. Never output singing, speech, chanting, choir, beatboxing, or any human vocal sounds including gibberish or mumbling. Use only instruments and non-vocal synthesizers.',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Lyria generation failed'
    console.error('generate-music: Lyria call failed', e)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const extracted = extractAudioFromResponse(response)
  if (!extracted) {
    console.error(
      'generate-music: no audio in response',
      JSON.stringify(response, null, 2).slice(0, 2000),
    )
    return NextResponse.json({ error: 'No audio in Lyria response' }, { status: 502 })
  }

  const ext = extensionForMime(extracted.mimeType)
  const fileName = `music-${projectId}-${Date.now()}.${ext}`
  const contentType =
    ext === 'wav' ? 'audio/wav' : extracted.mimeType.startsWith('audio/') ? extracted.mimeType : 'audio/mpeg'

  const supabase = createServerClient()
  const { error: uploadError } = await supabase.storage.from(MUSIC_BUCKET).upload(fileName, extracted.buffer, {
    contentType,
    upsert: true,
  })

  if (uploadError) {
    console.error('generate-music: upload', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(MUSIC_BUCKET).getPublicUrl(fileName)

  const { error: projectErr } = await supabase.from('projects').update({ music_url: publicUrl }).eq('id', projectId)

  if (projectErr) {
    console.warn('generate-music: could not persist music_url', projectErr.message)
  }

  return NextResponse.json({ musicUrl: publicUrl })
}
