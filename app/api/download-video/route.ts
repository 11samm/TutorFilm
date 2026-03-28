import { NextResponse } from 'next/server'

function isAllowedVideoUrl(urlStr: string): boolean {
  let url: URL
  try {
    url = new URL(urlStr)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseBase) {
    try {
      const allowedHost = new URL(supabaseBase).hostname
      if (url.hostname === allowedHost) return true
    } catch {
      /* ignore */
    }
  }
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return true
  }
  return false
}

/**
 * Server-side fetch so the browser can download cross-origin videos without CORS on GET.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const url =
    typeof body === 'object' &&
    body !== null &&
    'url' in body &&
    typeof (body as { url: unknown }).url === 'string'
      ? (body as { url: string }).url
      : ''
  if (!url || !isAllowedVideoUrl(url)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 })
  }

  try {
    const upstream = await fetch(url, { cache: 'no-store' })
    if (!upstream.ok) {
      return NextResponse.json(
        { error: upstream.statusText || 'Upstream fetch failed' },
        { status: 502 }
      )
    }
    const contentType = upstream.headers.get('content-type') || 'video/mp4'
    const buf = await upstream.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment; filename="tutor-film-lesson.mp4"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('POST /api/download-video', e)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  }
}
