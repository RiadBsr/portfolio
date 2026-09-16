import { NextResponse, type NextRequest } from 'next/server'

/**
 * Site pause gate (Next 16 proxy convention — the former `middleware.ts`).
 *
 * While the site is paused the only thing the world can reach is the pause
 * screen at `/`. Everything else — the chat API, the GLB models, the 360
 * textures, the resume PDF, the manifest, any stray route — is answered with
 * a 404, and any HTML navigation is rewritten to the pause screen so no URL
 * leaks the existence of the rest of the site.
 *
 * `_next/static` and `_next/image` are excluded by the matcher because the
 * pause screen's own CSS and fonts are served from there.
 *
 * To bring the site back, see "Paused state" in README.md.
 */

// The only paths served while paused. `/robots.txt` stays reachable so
// crawlers can be told to stay away.
const ALLOWED_PATHS = new Set(['/', '/robots.txt'])

const SEALED_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
}

function withSealedHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SEALED_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (ALLOWED_PATHS.has(pathname)) {
    return withSealedHeaders(NextResponse.next())
  }

  // A browser asking for a page gets the pause screen, whatever URL it tried.
  const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html')
  if (wantsHtml && !pathname.startsWith('/api/')) {
    return withSealedHeaders(NextResponse.rewrite(new URL('/', request.url)))
  }

  // Everything else — API calls, assets, RSC payloads — does not exist.
  return new NextResponse(null, { status: 404, headers: SEALED_HEADERS })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
