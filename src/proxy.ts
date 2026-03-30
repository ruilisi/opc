import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

const PUBLIC_PATHS = ['/login', '/oauth/callback', '/api/auth/login', '/api/auth/callback', '/api/auth/logout', '/api/auth/oauth-token', '/invite/', '/api/invites/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // In dev-online mode, proxy API requests to the remote server server-side
  // (avoids CORS — browser sees same-origin requests to localhost).
  // Excludes /api/auth/logout so the local session cookie is cleared properly.
  if (process.env.REMOTE_API_URL && pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/logout') && !pathname.startsWith('/api/auth/callback')) {
    const remoteUrl = process.env.REMOTE_API_URL + pathname + request.nextUrl.search
    // Only forward cookie and content-type — forwarding all headers causes ECONNREFUSED
    // in Node.js 18+ (problematic headers like transfer-encoding confuse undici)
    const headers = new Headers()
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    const contentType = request.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    // Authenticate to the remote with a dev API token (local JWT is signed with a
    // different secret and would be rejected by the remote server)
    if (process.env.DEV_ONLINE_TOKEN) {
      headers.set('authorization', `Bearer ${process.env.DEV_ONLINE_TOKEN}`)
    }
    const isBodyMethod = !['GET', 'HEAD'].includes(request.method)
    const res = await fetch(remoteUrl, {
      method: request.method,
      headers,
      body: isBodyMethod ? request.body : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(isBodyMethod && { duplex: 'half' } as any),
    })
    // Strip Secure flag from Set-Cookie so the browser accepts cookies on http://localhost
    const responseHeaders = new Headers(res.headers)
    const setCookie = responseHeaders.get('set-cookie')
    if (setCookie) responseHeaders.set('set-cookie', setCookie.replace(/;\s*Secure/gi, ''))
    return new NextResponse(res.body, { status: res.status, headers: responseHeaders })
  }

  // In dev-online mode, allow all page routes through without local auth —
  // API data comes from the remote (authenticated above); no local DB is needed.
  if (process.env.REMOTE_API_URL && !pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check Bearer token (API access)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const tokenHash = createHash('sha256').update(token).digest('hex')

    // Full user token
    const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash } })
    if (apiToken) {
      const response = NextResponse.next()
      response.headers.set('x-user-id', apiToken.userId)
      return response
    }

    // Board-scoped token
    const boardToken = await prisma.boardToken.findUnique({
      where: { tokenHash },
      include: { board: { include: { members: { where: { role: 'owner' } } } } },
    })
    if (boardToken) {
      const owner = boardToken.board.members[0]
      if (!owner) return NextResponse.json({ error: 'Board has no owner' }, { status: 403 })
      const response = NextResponse.next()
      response.headers.set('x-user-id', owner.userId)
      response.headers.set('x-board-token-scope', boardToken.boardId)
      return response
    }

    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Check session cookie
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value
  if (!sessionToken) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const session = await verifySession(sessionToken)
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const response = NextResponse.next()
  response.headers.set('x-user-id', session.sub)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
