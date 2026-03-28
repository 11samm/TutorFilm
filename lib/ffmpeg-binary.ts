import { existsSync } from 'fs'
import path from 'path'

/**
 * Resolve an ffmpeg executable for server-side routes.
 *
 * Order: `FFMPEG_PATH` → bundled `ffmpeg-static` (if file exists) →
 * `node_modules/ffmpeg-static/ffmpeg` from cwd → `ffmpeg` on `PATH`.
 *
 * Next.js bundling can break `ffmpeg-static`'s `__dirname`; `serverExternalPackages`
 * in `next.config.mjs` keeps the package on disk. If the binary was never
 * downloaded (failed postinstall), install system ffmpeg or set `FFMPEG_PATH`.
 */
let cached: string | null = null

export function resolveFfmpegBinary(): string {
  if (cached) return cached

  const fromEnv = process.env.FFMPEG_PATH?.trim()
  if (fromEnv && existsSync(fromEnv)) {
    cached = fromEnv
    return fromEnv
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require('ffmpeg-static') as string | null | undefined
    if (staticPath && existsSync(staticPath)) {
      cached = staticPath
      return staticPath
    }
  } catch {
    /* ffmpeg-static not resolvable */
  }

  const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const cwdStatic = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', name)
  if (existsSync(cwdStatic)) {
    cached = cwdStatic
    return cwdStatic
  }

  cached = 'ffmpeg'
  return 'ffmpeg'
}
