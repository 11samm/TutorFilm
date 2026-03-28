/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  /** Keep native ffmpeg binary on disk; bundling breaks `ffmpeg-static` paths (ENOENT). */
  serverExternalPackages: ['ffmpeg-static'],
}

export default nextConfig
