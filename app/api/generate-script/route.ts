import { GoogleGenAI, Type } from '@google/genai'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { geminiScriptOutputSchema } from '@/lib/gemini-script-schema'
import { normalizeSceneDurationSeconds, snapDurationsInScript } from '@/lib/veo-duration'
import { countWords, validateDurationBudget, validateScenes } from '@/lib/validate-script'
import type {
  AvatarType,
  GenerateScriptRequest,
  GenerateScriptResponse,
  GeminiScriptOutput,
  Scene,
  TargetAgeBand,
} from '@/lib/types'

const TARGET_AGE_BANDS: TargetAgeBand[] = ['preschool', 'kindergarten', 'primary']

function isTargetAgeBand(x: unknown): x is TargetAgeBand {
  return typeof x === 'string' && TARGET_AGE_BANDS.includes(x as TargetAgeBand)
}

function avatarVisualDirective(avatarType: AvatarType): string {
  switch (avatarType) {
    case 'none':
      return 'B-roll and environments only (maps, props, locations, diagrams). Do not introduce a recurring on-screen teacher, mascot, or character face.'
    case 'default_male':
      return 'When sceneType is avatar_present or mixed, the visuals MUST show a consistent friendly male 3D Pixar-style teacher character as the on-screen presenter.'
    case 'default_female':
      return 'When sceneType is avatar_present or mixed, the visuals MUST show a consistent friendly female 3D Pixar-style teacher character as the on-screen presenter.'
    case 'custom':
      return 'When sceneType is avatar_present or mixed, the visuals MUST show a consistent custom teacher avatar derived from a selfie reference (treat as the same character across scenes).'
    default:
      return ''
  }
}

function targetAgeDialogueGuidance(band: TargetAgeBand): string {
  switch (band) {
    case 'preschool':
      return 'Preschool band (ages ~3–5): very simple words, concrete nouns, gentle repetition, avoid abstract jargon.'
    case 'kindergarten':
      return 'Kindergarten band (ages ~5–6): short clear sentences, playful but precise, light metaphors only.'
    case 'primary':
      return 'Primary band (ages ~7–10): richer vocabulary allowed, short analogies OK, still kid-safe and upbeat.'
    default:
      return ''
  }
}

const MODEL = 'gemini-3.1-pro-preview'

function buildResponseSchema() {
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
        description:
          'Ordered list of scenes for the full video. MUST include at least 1 scene and at most 48 scenes.',
        items: {
          type: Type.OBJECT,
          required: ['order', 'sceneType', 'dialogue', 'visualPrompt', 'durationSeconds'],
          properties: {
            order: { type: Type.INTEGER, description: '1-based scene index in playback order' },
            sceneType: {
              type: Type.STRING,
              format: 'enum',
              enum: ['avatar_present', 'broll', 'mixed'],
              description: 'One of: avatar_present, broll, mixed',
            },
            durationSeconds: {
              type: Type.INTEGER,
              description:
                'Scene length in seconds. MUST be exactly 4, 6, or 8 only — even integers in that set. No odd numbers (no 5 or 7).',
            },
            dialogue: {
              type: Type.STRING,
              description:
                'Spoken narration; word count must not exceed floor(durationSeconds * 2.5) words',
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

function buildSystemInstruction(req: GenerateScriptRequest): string {
  const { voiceCharacterId, avatarType, targetAge, targetDurationSeconds } = req
  const visualAvatarRule = avatarVisualDirective(avatarType)
  const dialogueAgeRule = targetAgeDialogueGuidance(targetAge)

  return `You are the Director. The user wants a video of exactly ${targetDurationSeconds} seconds total. You must break this down into multiple scenes.

DURATION (NON-NEGOTIABLE):
- All scene durations MUST be exactly 4, 6, or 8 seconds. No other values.
- All scene durations MUST be even integers — use only 4, 6, or 8. No odd numbers (never 5 or 7).
- The sum of all \`durationSeconds\` across scenes MUST equal ${targetDurationSeconds} exactly.
- Choose per-scene lengths from {4, 6, 8} to fit pacing.

For the dialogue, strictly follow ~2.5 words per second (e.g., a 4-second scene gets max 10 words, an 8-second scene gets max 20 words).

Your output must be ONLY valid JSON matching the enforced response schema — no markdown fences, no commentary.

TARGET AUDIENCE BAND: ${targetAge}
${dialogueAgeRule}
Tune every scene's "dialogue" vocabulary and complexity to this band.

DECOUPLING (CRITICAL — DO NOT VIOLATE):
- The "visualPrompt" MUST follow the chosen VISUAL avatar mode (avatarType = "${avatarType}"): ${visualAvatarRule}
- The "visualPrompt" MUST feature the chosen visual avatar type (${avatarType}). NEVER describe the visual appearance based on the "voiceCharacterId". The voice character is STRICTLY for the audio track and must not influence the visual description.
- Do NOT place fantasy creatures, animals, gnomes, mermaids, sprites, or any persona implied by voiceCharacterId ("${voiceCharacterId}") into "visualPrompt" unless the lesson topic itself requires that subject matter.
- Never use voiceCharacterId to pick what the on-screen character looks like; visuals follow avatarType only.

CRITICAL RULES:
- Each scene's "durationSeconds" MUST be exactly 4, 6, or 8 (even seconds only — never 5 or 7).
- The sum of every scene's "durationSeconds" MUST equal exactly ${targetDurationSeconds}.
- Each scene's "dialogue" word count MUST NOT exceed Math.floor(durationSeconds * 2.5) words for that scene.
- Each "visualPrompt" must describe cinematic shots in a Pixar / Disney Junior–style 3D animation look (bright, readable, child-friendly) while obeying the visual avatar rules above.
- Set "voiceCharacterId" to exactly: "${voiceCharacterId}" (do not use any other voice id). This id is for labeling narration style only.
- "order" must be a contiguous sequence starting at 1 with no gaps or duplicates.
- "sceneType" must be one of: avatar_present | broll | mixed — choose what fits the beat of the lesson.`
}

function buildUserPrompt(req: GenerateScriptRequest): string {
  const parts: string[] = [
    `Lesson concept (plain text):\n${req.lessonPrompt}`,
    `Target audience band (for dialogue only): ${req.targetAge}`,
    `Total target video duration: ${req.targetDurationSeconds} seconds — allocate across scenes using only 4, 6, or 8 seconds per scene; durations must sum to this total.`,
    `Visual avatar mode for this project (controls on-screen look only): ${req.avatarType}.`,
    `Voice character id (audio / narration label only — must appear verbatim in the JSON, must NOT drive visuals): ${req.voiceCharacterId}`,
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
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('Gemini returned invalid JSON')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Gemini returned non-object JSON')
  }
  const result = geminiScriptOutputSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `Script JSON failed schema validation: ${result.error.issues.map((e) => e.message).join('; ')}`
    )
  }
  return result.data as GeminiScriptOutput
}

async function callGemini(
  ai: GoogleGenAI,
  systemInstruction: string,
  userContent: string
): Promise<GeminiScriptOutput> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction,
      temperature: 0.35,
      responseMimeType: 'application/json',
      responseSchema: buildResponseSchema(),
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
    typeof b.targetDurationSeconds !== 'number' ||
    !Number.isFinite(b.targetDurationSeconds) ||
    b.targetDurationSeconds <= 0 ||
    !isTargetAgeBand(b.targetAge)
  ) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid fields: lessonPrompt (string), avatarType, voiceCharacterId, targetAge (preschool | kindergarten | primary), targetDurationSeconds (positive number)',
      },
      { status: 400 }
    )
  }

  const req: GenerateScriptRequest = {
    lessonPrompt: b.lessonPrompt,
    pdfUrl: typeof b.pdfUrl === 'string' ? b.pdfUrl : undefined,
    avatarType: b.avatarType as GenerateScriptRequest['avatarType'],
    voiceCharacterId: b.voiceCharacterId,
    targetAge: b.targetAge,
    targetDurationSeconds: b.targetDurationSeconds,
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: GEMINI_API_KEY is not set' }, { status: 500 })
  }

  const systemInstruction = buildSystemInstruction(req)
  const baseUserPrompt = buildUserPrompt(req)

  const ai = new GoogleGenAI({ apiKey })

  try {
    let script = await callGemini(ai, systemInstruction, baseUserPrompt)
    script.voiceCharacterId = req.voiceCharacterId
    script = snapDurationsInScript(script)

    const budget = validateDurationBudget(script.scenes, req.targetDurationSeconds)
    let validation = validateScenes(script.scenes)

    if (!budget.valid || !validation.valid) {
      const retryUserContent = `${baseUserPrompt}

---
CORRECTION REQUIRED — your previous JSON failed validation.
- Duration sum: got ${budget.sum}, must equal ${req.targetDurationSeconds} seconds total.
- Violations: ${JSON.stringify(validation.violations)}
Regenerate the ENTIRE JSON. Obey duration budget: each scene's durationSeconds MUST be exactly 4, 6, or 8 (even only — no 5 or 7), and per-scene word limits (~2.5 words per second of dialogue). Preserve "voiceCharacterId" as "${req.voiceCharacterId}".`

      script = await callGemini(ai, systemInstruction, retryUserContent)
      script.voiceCharacterId = req.voiceCharacterId
      script = snapDurationsInScript(script)

      const budget2 = validateDurationBudget(script.scenes, req.targetDurationSeconds)
      validation = validateScenes(script.scenes)
      if (!budget2.valid || !validation.valid) {
        return NextResponse.json(
          {
            error: 'Script validation failed after retry',
            durationSum: budget2.sum,
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
      duration_seconds: normalizeSceneDurationSeconds(s.durationSeconds),
      status: 'pending' as const,
    }))

    const { data: sceneRows, error: scenesError } = await supabase
      .from('scenes')
      .insert(sceneInserts)
      .select(
        'id, order, dialogue, word_count, visual_prompt, scene_type, duration_seconds, thumbnail_url, video_url, status'
      )

    if (scenesError || !sceneRows?.length) {
      console.error('Supabase scenes insert:', scenesError)
      return NextResponse.json(
        { error: scenesError?.message ?? 'Failed to insert scenes' },
        { status: 500 }
      )
    }

    sceneRows.sort((a, b) => (a.order as number) - (b.order as number))

    const scenes: Scene[] = sceneRows.map((row) => {
      const dialogue = row.dialogue as string
      const visualPrompt = row.visual_prompt as string
      return {
        id: row.id as string,
        order: row.order as number,
        sceneType: row.scene_type as Scene['sceneType'],
        dialogue,
        wordCount: row.word_count as number,
        durationSeconds: normalizeSceneDurationSeconds(
          Number(row.duration_seconds ?? 8)
        ),
        visualPrompt,
        thumbnailPrompt: visualPrompt,
        scriptHtml: dialogue,
        confirmed: false,
        thumbnailUrl: row.thumbnail_url as string | null,
        videoUrl: row.video_url as string | null,
        status: row.status as Scene['status'],
      }
    })

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
