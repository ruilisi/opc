import { NextRequest, NextResponse } from 'next/server'
import { verifySession, COOKIE_NAME } from '@/lib/auth'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

const PUBLIC_PATHS = ['/login', '/oauth/callback', '/api/auth/']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check Bearer token (API access)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash } })
    if (apiToken) {
      const response = NextResponse.next()
      response.headers.set('x-user-id', apiToken.userId)
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
