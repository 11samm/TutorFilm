import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { NextResponse } from 'next/server'
import { resolveFfmpegBinary } from '@/lib/ffmpeg-binary'
import { createServerClient } from '@/lib/supabase'
import { z } from 'zod'

/** Vercel / Next.js route max duration — downloads + ffmpeg + upload. */
export const maxDuration = 300

const VIDEOS_BUCKET = 'videos'

const bodySchema = z.object({
  projectId: z.string().uuid(),
})

function escapeConcatFilePath(p: string): string {
  const normalized = p.replace(/\\/g, '/')
  return normalized.replace(/'/g, "'\\''")
}

async function runFfmpeg(args: string[]): Promise<void> {
  const bin = resolveFfmpegBinary()
  await new Promise<void>((resolve, reject) => {
    const ff = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    ff.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString()
    })
    ff.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            `ffmpeg not found (${bin}). Install ffmpeg (e.g. brew install ffmpeg) and set FFMPEG_PATH to the binary, or reinstall node_modules so ffmpeg-static can download its binary.`,
          ),
        )
      } else {
        reject(err)
      }
    })
    ff.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `ffmpeg exited ${code}`))
    })
  })
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download scene video (${res.status})`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(dest, buf)
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body: projectId (uuid) required' }, { status: 400 })
  }

  const { projectId } = parsed.data
  const supabase = createServerClient()

  const { data: scenes, error: scenesError } = await supabase
    .from('scenes')
    .select('id, order, video_url')
    .eq('project_id', projectId)
    .order('order', { ascending: true })

  if (scenesError) {
    console.error('stitch-scenes: scenes query', scenesError)
    return NextResponse.json({ error: scenesError.message }, { status: 500 })
  }

  const rows = (scenes ?? []) as Array<{ id: string; order: number; video_url: string | null }>
  const withVideo = rows.filter((r) => r.video_url && String(r.video_url).trim().length > 0)

  if (withVideo.length === 0) {
    return NextResponse.json({ error: 'No scene videos to stitch' }, { status: 400 })
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'tutorfilm-stitch-'))
  const listPath = path.join(tmpRoot, 'concat.txt')
  const outPath = path.join(tmpRoot, 'assembled.mp4')

  try {
    const segmentPaths: string[] = []
    for (let i = 0; i < withVideo.length; i += 1) {
      const url = withVideo[i].video_url as string
      const seg = path.join(tmpRoot, `scene-${i}.mp4`)
      await downloadToFile(url, seg)
      segmentPaths.push(seg)
    }

    const listBody = segmentPaths
      .map((p) => `file '${escapeConcatFilePath(p)}'`)
      .join('\n')
    await fs.writeFile(listPath, listBody, 'utf8')

    await runFfmpeg([
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outPath,
    ])

    const assembledBuffer = await fs.readFile(outPath)
    const fileName = `assembled-${projectId}-${Date.now()}.mp4`

    const { error: uploadError } = await supabase.storage.from(VIDEOS_BUCKET).upload(fileName, assembledBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

    if (uploadError) {
      console.error('stitch-scenes: upload', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(fileName)

    const { error: projectErr } = await supabase
      .from('projects')
      .update({ assembled_scenes_video_url: publicUrl })
      .eq('id', projectId)

    if (projectErr) {
      console.warn(
        'stitch-scenes: could not persist assembled_scenes_video_url (add column to projects?)',
        projectErr.message
      )
    }

    return NextResponse.json({ assembledScenesVideoUrl: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stitch failed'
    console.error('stitch-scenes:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}
