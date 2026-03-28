import { existsSync } from 'fs'
import path from 'path'
import { resolveFfmpegBinary } from '@/lib/ffmpeg-binary'

/** Resolve ffprobe next to ffmpeg-static / PATH (override with `FFPROBE_PATH`). */
export function resolveFfprobeBinary(): string {
  const fromEnv = process.env.FFPROBE_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const ffmpeg = resolveFfmpegBinary()
  if (ffmpeg.endsWith('ffmpeg.exe')) {
    const candidate = ffmpeg.replace(/ffmpeg\.exe$/i, 'ffprobe.exe')
    if (existsSync(candidate)) return candidate
  }
  if (ffmpeg.endsWith('ffmpeg')) {
    const candidate = ffmpeg.replace(/ffmpeg$/i, 'ffprobe')
    if (existsSync(candidate)) return candidate
  }

  return 'ffprobe'
}
