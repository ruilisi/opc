import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

const PUBLIC_PATHS = ['/login', '/oauth/callback', '/api/auth/', '/invite/', '/api/invites/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // In online mode, proxy /api/* directly to the remote server (except /api/auth/ which handles local sessions)
  if (process.env.REMOTE_API_URL && pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const remoteUrl = process.env.REMOTE_API_URL + pathname + request.nextUrl.search
    const headers = new Headers(request.headers)
    headers.delete('host')
    const isBodyMethod = !['GET', 'HEAD'].includes(request.method)
    const res = await fetch(remoteUrl, {
      method: request.method,
      headers,
      body: isBodyMethod ? request.body : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(isBodyMethod && { duplex: 'half' } as any),
    })
    return new NextResponse(res.body, { status: res.status, headers: res.headers })
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
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const session = await verifySession(sessionToken)
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete(COOKIE_NAME)
    return response
  }

  const response = NextResponse.next()
  response.headers.set('x-user-id', session.sub)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
