import { execFileSync } from 'child_process'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveFfmpegBinary } from '@/lib/ffmpeg-binary'
import { resolveFfprobeBinary } from '@/lib/ffprobe-binary'
import { createServerClient } from '@/lib/supabase'

export const maxDuration = 300

const FINAL_BUCKET = 'final-videos'

const bodySchema = z.object({
  projectId: z.string().uuid(),
  assembledScenesVideoUrl: z.string().url(),
  musicUrl: z.string().url(),
})

function hasAudioStream(videoPath: string): boolean {
  const ffprobe = resolveFfprobeBinary()
  try {
    const out = execFileSync(
      ffprobe,
      [
        '-v',
        'error',
        '-select_streams',
        'a',
        '-show_entries',
        'stream=codec_type',
        '-of',
        'csv=p=0',
        videoPath,
      ],
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
    )
    return out.trim().length > 0
  } catch {
    return false
  }
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
            `ffmpeg not found (${bin}). Install ffmpeg or set FFMPEG_PATH, or reinstall ffmpeg-static.`,
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
    throw new Error(`Failed to download (${res.status})`)
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
    return NextResponse.json(
      { error: 'Invalid body: projectId, assembledScenesVideoUrl, musicUrl required' },
      { status: 400 },
    )
  }

  const { projectId, assembledScenesVideoUrl, musicUrl } = parsed.data

  const tmpRoot = path.join(os.tmpdir(), `tutorfilm-final-${projectId}-${Date.now()}`)
  const videoPath = path.join(tmpRoot, 'assembled.mp4')
  const musicPath = path.join(tmpRoot, 'music-audio')
  const outPath = path.join(tmpRoot, 'final.mp4')

  try {
    await fs.mkdir(tmpRoot, { recursive: true })
    await downloadToFile(assembledScenesVideoUrl, videoPath)
    await downloadToFile(musicUrl, musicPath)

    const hasAudio = hasAudioStream(videoPath)

    /** Mix dialogue + ducked music; `duration=first` matches video length; `-shortest` trims long music per product spec. */
    const filterComplex = hasAudio
      ? '[1:a]volume=0.10[mus];[0:a][mus]amix=inputs=2:duration=first:dropout_transition=2[aout]'
      : '[1:a]volume=0.10[aout]'

    const args = [
      '-y',
      '-i',
      videoPath,
      '-i',
      musicPath,
      '-filter_complex',
      filterComplex,
      '-map',
      '0:v',
      '-map',
      '[aout]',
      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-shortest',
      outPath,
    ]

    await runFfmpeg(args)

    const finalBuffer = await fs.readFile(outPath)
    const fileName = `final-${projectId}.mp4`

    const supabase = createServerClient()
    const { error: uploadError } = await supabase.storage.from(FINAL_BUCKET).upload(fileName, finalBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

    if (uploadError) {
      console.error('stitch-video: upload', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(FINAL_BUCKET).getPublicUrl(fileName)

    const { error: projectErr } = await supabase
      .from('projects')
      .update({ final_video_url: publicUrl, status: 'complete' })
      .eq('id', projectId)

    if (projectErr) {
      console.warn('stitch-video: could not persist final_video_url / status', projectErr.message)
    }

    return NextResponse.json({ finalVideoUrl: publicUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Final mux failed'
    console.error('stitch-video:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}
