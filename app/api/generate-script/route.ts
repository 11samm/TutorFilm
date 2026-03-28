import { GoogleGenAI, Type } from '@google/genai'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { countWords, validateScenes } from '@/lib/validate-script'
import type {
  GenerateScriptRequest,
  GenerateScriptResponse,
  GeminiScriptOutput,
  Scene,
} from '@/lib/types'

const MODEL = 'gemini-3.1-pro-preview'

function buildResponseSchema(targetSceneCount: number) {
  const n = String(targetSceneCount)
  return {
    type: Type.OBJECT,
    required: ['title', 'targetAge', 'artStyle', 'voiceCharacterId', 'musicMood', 'scenes'],
    properties: {
      title: { type: Type.STRING, description: 'Short title for the lesson video' },
      targetAge: { type: Type.STRING, description: 'e.g. "5-8"' },
      artStyle: {
        type: Type.STRING,
        format: 'enum',
        enum: ['pixar_3d', 'disney_junior', 'watercolor_storybook'],
        description: 'Visual art style for thumbnails and video',
      },
      voiceCharacterId: {
        type: Type.STRING,
        description: 'Must match the voiceCharacterId provided in the user request exactly',
      },
      musicMood: {
        type: Type.STRING,
        description: 'Comma-separated emotional keywords for background music',
      },
      scenes: {
        type: Type.ARRAY,
        minItems: n,
        maxItems: n,
        items: {
          type: Type.OBJECT,
          required: ['order', 'sceneType', 'dialogue', 'visualPrompt'],
          properties: {
            order: { type: Type.INTEGER, description: '1-based scene index' },
            sceneType: {
              type: Type.STRING,
              format: 'enum',
              enum: ['avatar_present', 'broll', 'mixed'],
            },
            dialogue: {
              type: Type.STRING,
              description: 'Spoken narration; MUST be between 18 and 20 words inclusive',
            },
            visualPrompt: {
              type: Type.STRING,
              description: 'Pixar/Disney Junior 3D art direction for this scene',
            },
          },
        },
      },
    },
  }
}

function buildSystemInstruction(targetSceneCount: number, voiceCharacterId: string): string {
  return `You are an expert children's educational video scriptwriter for ages roughly 5–8.
Your output must be ONLY valid JSON matching the enforced response schema — no markdown fences, no commentary.

CRITICAL RULES:
- Produce EXACTLY ${targetSceneCount} scenes in the "scenes" array (no more, no fewer).
- Each scene's "dialogue" MUST contain between 18 and 20 words (inclusive). Count every word carefully before responding. Too short is acceptable; over 20 words is NEVER allowed.
- Each "visualPrompt" must describe cinematic shots in a Pixar / Disney Junior–style 3D animation look (bright, readable, child-friendly).
- Set "voiceCharacterId" to exactly: "${voiceCharacterId}" (do not use any other voice id).
- "order" must run from 1 through ${targetSceneCount} in sequence without gaps or duplicates.
- "sceneType" must be one of: avatar_present | broll | mixed — choose what fits the beat of the lesson.`
}

function buildUserPrompt(req: GenerateScriptRequest, targetSceneCount: number): string {
  const parts: string[] = [
    `Lesson concept (plain text):\n${req.lessonPrompt}`,
    `Target approximate video length: ${req.targetDurationMinutes} minutes → you MUST output exactly ${targetSceneCount} scenes (8 seconds each).`,
    `Avatar mode for this project: ${req.avatarType}.`,
    `Voice character id (must appear verbatim in the JSON): ${req.voiceCharacterId}`,
  ]
  if (req.pdfUrl) {
    parts.push(`Optional PDF context URL (for your reference only; you may not fetch it): ${req.pdfUrl}`)
  }
  return parts.join('\n\n')
}

function parseGeminiScript(text: string | undefined): GeminiScriptOutput {
  if (!text?.trim()) {
    throw new Error('Empty response from Gemini')
  }
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Gemini returned non-object JSON')
  }
  return parsed as GeminiScriptOutput
}

async function callGemini(
  ai: GoogleGenAI,
  systemInstruction: string,
  userContent: string,
  targetSceneCount: number
): Promise<GeminiScriptOutput> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction,
      temperature: 0.35,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(targetSceneCount),
    },
  })
  return parseGeminiScript(response.text)
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

  const b = body as Partial<GenerateScriptRequest>
  if (
    typeof b.lessonPrompt !== 'string' ||
    typeof b.avatarType !== 'string' ||
    typeof b.voiceCharacterId !== 'string' ||
    typeof b.targetDurationMinutes !== 'number' ||
    !Number.isFinite(b.targetDurationMinutes)
  ) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid fields: lessonPrompt (string), avatarType, voiceCharacterId, targetDurationMinutes (number)',
      },
      { status: 400 }
    )
  }

  const req: GenerateScriptRequest = {
    lessonPrompt: b.lessonPrompt,
    pdfUrl: typeof b.pdfUrl === 'string' ? b.pdfUrl : undefined,
    avatarType: b.avatarType as GenerateScriptRequest['avatarType'],
    voiceCharacterId: b.voiceCharacterId,
    targetDurationMinutes: b.targetDurationMinutes,
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set' }, { status: 500 })
  }

  const targetSceneCount = Math.max(1, Math.ceil((req.targetDurationMinutes * 60) / 8))
  const systemInstruction = buildSystemInstruction(targetSceneCount, req.voiceCharacterId)
  const baseUserPrompt = buildUserPrompt(req, targetSceneCount)

  const ai = new GoogleGenAI({ apiKey })

  try {
    let script = await callGemini(ai, systemInstruction, baseUserPrompt, targetSceneCount)
    script.voiceCharacterId = req.voiceCharacterId

    let validation = validateScenes(script.scenes)
    if (!validation.valid) {
      const retryUserContent = `${baseUserPrompt}

---
CORRECTION REQUIRED — your previous JSON had scenes with more than 20 words in "dialogue".
Violations (by scene order): ${JSON.stringify(validation.violations)}
Regenerate the ENTIRE JSON. Every scene's dialogue must be 18–20 words. Keep EXACTLY ${targetSceneCount} scenes. Preserve "voiceCharacterId" as "${req.voiceCharacterId}".`

      script = await callGemini(ai, systemInstruction, retryUserContent, targetSceneCount)
      script.voiceCharacterId = req.voiceCharacterId
      validation = validateScenes(script.scenes)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Script validation failed after retry',
            violations: validation.violations,
          },
          { status: 422 }
        )
      }
    }

    const supabase = createServerClient()
    const sessionId = crypto.randomUUID()

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .insert({
        session_id: sessionId,
        status: 'scripting',
        lesson_prompt: req.lessonPrompt,
        pdf_url: req.pdfUrl ?? null,
        avatar_type: req.avatarType,
        voice_character_id: req.voiceCharacterId,
        character_angles_url: null,
        script_json: script as unknown as Record<string, unknown>,
      })
      .select('id')
      .single()

    if (projectError || !projectRow?.id) {
      console.error('Supabase project insert:', projectError)
      return NextResponse.json(
        { error: projectError?.message ?? 'Failed to create project' },
        { status: 500 }
      )
    }

    const projectId = projectRow.id as string

    const sceneInserts = script.scenes.map((s) => ({
      project_id: projectId,
      order: s.order,
      dialogue: s.dialogue,
      word_count: countWords(s.dialogue),
      visual_prompt: s.visualPrompt,
      scene_type: s.sceneType,
      status: 'pending' as const,
    }))

    const { data: sceneRows, error: scenesError } = await supabase
      .from('scenes')
      .insert(sceneInserts)
      .select('id, order, dialogue, word_count, visual_prompt, scene_type, thumbnail_url, video_url, status')

    if (scenesError || !sceneRows?.length) {
      console.error('Supabase scenes insert:', scenesError)
      return NextResponse.json(
        { error: scenesError?.message ?? 'Failed to insert scenes' },
        { status: 500 }
      )
    }

    sceneRows.sort((a, b) => (a.order as number) - (b.order as number))

    const scenes: Scene[] = sceneRows.map((row) => ({
      id: row.id as string,
      order: row.order as number,
      sceneType: row.scene_type as Scene['sceneType'],
      dialogue: row.dialogue as string,
      wordCount: row.word_count as number,
      visualPrompt: row.visual_prompt as string,
      thumbnailUrl: row.thumbnail_url as string | null,
      videoUrl: row.video_url as string | null,
      status: row.status as Scene['status'],
    }))

    const payload: GenerateScriptResponse = {
      projectId,
      script,
      scenes,
    }

    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    console.error('generate-script:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
