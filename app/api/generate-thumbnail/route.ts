import { GoogleGenAI, createUserContent } from '@google/genai'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { GenerateThumbnailRequest, GenerateThumbnailResponse } from '@/lib/types'

const MODEL = 'gemini-3.1-flash-image-preview'
const THUMBNAILS_BUCKET = 'thumbnails'

/** Appended to every scene visual prompt so downstream video avoids warped on-image text. */
const TEXTLESS_THUMBNAIL_SUFFIX =
  ', completely textless, no text, no words, no typography, no watermarks, no signs.'

function visualPromptForImageModel(visualPrompt: string): string {
  return `${visualPrompt.trim()}${TEXTLESS_THUMBNAIL_SUFFIX}`
}

async function fetchCharacterReferenceAsInlineData(
  characterAnglesUrl: string
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  try {
    const imgRes = await fetch(characterAnglesUrl)
    if (!imgRes.ok) {
      console.warn('Character reference fetch failed:', imgRes.status, characterAnglesUrl)
      return null
    }
    const arrayBuffer = await imgRes.arrayBuffer()
    const base64String = Buffer.from(arrayBuffer).toString('base64')
    const mimeType =
      imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png'
    return {
      inlineData: {
        data: base64String,
        mimeType: mimeType || 'image/png',
      },
    }
  } catch (e) {
    console.warn('Character reference fetch error, falling back to text-only:', e)
    return null
  }
}

function buildThumbnailUserPrompt(
  visualPrompt: string,
  artStyle: string,
  hasCharacterRef: boolean
): string {
  const styleLine = `Art style: ${artStyle.replace(/_/g, ' ')} — Pixar / Disney Junior–quality 3D animation, bright and readable.`
  if (hasCharacterRef) {
    return `${styleLine}

The attached image is the exact character reference sheet for the on-screen teacher/presenter. Match the character's face, proportions, hair, and wardrobe from this reference whenever a person appears. Do not invent a different-looking character.

Scene / shot to illustrate:
${visualPrompt}

Output one widescreen keyframe image suitable as a video thumbnail.`
  }
  return `${styleLine}

Scene / shot to illustrate:
${visualPrompt}

Output one widescreen keyframe image suitable as a video thumbnail.`
}

function extractImageBase64FromResponse(response: {
  candidates?: { content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }[]
}): { data: string; mimeType: string } | null {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    const data = part.inlineData?.data
    if (data) {
      return {
        data,
        mimeType: part.inlineData?.mimeType?.trim() || 'image/png',
      }
    }
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

  const b = body as Partial<GenerateThumbnailRequest>
  if (
    typeof b.sceneId !== 'string' ||
    typeof b.projectId !== 'string' ||
    typeof b.visualPrompt !== 'string' ||
    typeof b.artStyle !== 'string'
  ) {
    return NextResponse.json(
      { error: 'Missing or invalid fields: sceneId, projectId, visualPrompt, artStyle' },
      { status: 400 }
    )
  }

  const req: GenerateThumbnailRequest = {
    sceneId: b.sceneId,
    projectId: b.projectId,
    visualPrompt: b.visualPrompt,
    artStyle: b.artStyle as GenerateThumbnailRequest['artStyle'],
    characterAnglesUrl: typeof b.characterAnglesUrl === 'string' ? b.characterAnglesUrl : undefined,
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set' }, { status: 500 })
  }

  const supabase = createServerClient()

  const { error: statusErr } = await supabase
    .from('scenes')
    .update({ status: 'thumbnail_generating' })
    .eq('id', req.sceneId)

  if (statusErr) {
    console.error('generate-thumbnail: status update', statusErr)
    return NextResponse.json({ error: statusErr.message }, { status: 500 })
  }

  let inlineRef: { inlineData: { data: string; mimeType: string } } | null = null
  if (req.characterAnglesUrl) {
    inlineRef = await fetchCharacterReferenceAsInlineData(req.characterAnglesUrl)
  }

  const hasCharacterRef = inlineRef !== null
  const userPrompt = buildThumbnailUserPrompt(
    visualPromptForImageModel(req.visualPrompt),
    req.artStyle,
    hasCharacterRef
  )

  const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = []
  if (hasCharacterRef && inlineRef) {
    parts.push({
      text: `Use the following image as the exact character reference for the generated scene. The character in your output must match this reference when a person appears.`,
    })
    parts.push(inlineRef)
  }
  parts.push({ text: userPrompt })

  const ai = new GoogleGenAI({ apiKey })

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createUserContent(parts),
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio: '16:9',
        },
      },
    })

    const extracted = extractImageBase64FromResponse(
      response as Parameters<typeof extractImageBase64FromResponse>[0]
    )
    if (!extracted) {
      await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
      return NextResponse.json({ error: 'No image in model response' }, { status: 502 })
    }

    const ext = extracted.mimeType.includes('jpeg') || extracted.mimeType.includes('jpg') ? 'jpg' : 'png'
    const path = `${req.projectId}/${req.sceneId}.${ext}`
    const bytes = Buffer.from(extracted.data, 'base64')

    const { error: uploadError } = await supabase.storage.from(THUMBNAILS_BUCKET).upload(path, bytes, {
      contentType: extracted.mimeType,
      upsert: true,
    })

    if (uploadError) {
      console.error('generate-thumbnail: storage upload', uploadError)
      await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(path)

    const { error: finalErr } = await supabase
      .from('scenes')
      .update({ thumbnail_url: publicUrl, status: 'thumbnail_ready' })
      .eq('id', req.sceneId)

    if (finalErr) {
      console.error('generate-thumbnail: final scene update', finalErr)
      return NextResponse.json({ error: finalErr.message }, { status: 500 })
    }

    const payload: GenerateThumbnailResponse = { thumbnailUrl: publicUrl }
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('generate-thumbnail:', err)
    await supabase.from('scenes').update({ status: 'error' }).eq('id', req.sceneId)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
