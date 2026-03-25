import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signSession, COOKIE_NAME } from '@/lib/auth'
import type { UserInfo } from '@/types'

const OAUTH_API_URL = process.env.NEXT_PUBLIC_OAUTH_API_URL
const CLIENT_ID = process.env.OAUTH_CLIENT_ID ?? 'opc'
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET ?? ''

export async function POST(request: NextRequest) {
  const { code, redirectUri } = await request.json()
  if (!code || !redirectUri) {
    return NextResponse.json({ error: 'Missing code or redirectUri' }, { status: 400 })
  }

  // Exchange code for access token
  const tokenRes = await fetch(`${OAUTH_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  if (!tokenRes.ok) {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 401 })
  }
  const { access_token } = await tokenRes.json()

  // Fetch userinfo
  const userRes = await fetch(`${OAUTH_API_URL}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!userRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch userinfo' }, { status: 401 })
  }
  const userInfo: UserInfo = await userRes.json()

  // Upsert user
  const user = await prisma.user.upsert({
    where: { oauthId: userInfo.id },
    update: {
      name: userInfo.nickname,
      avatarUrl: userInfo.avatar_url,
      email: userInfo.email,
    },
    create: {
      oauthId: userInfo.id,
      name: userInfo.nickname,
      avatarUrl: userInfo.avatar_url,
      email: userInfo.email,
    },
  })

  // Ensure personal org exists (idempotent)
  const hasPersonal = await prisma.orgMember.findFirst({
    where: { userId: user.id, role: 'owner', org: { type: 'personal' } },
  })
  if (!hasPersonal) {
    const baseSlug = `personal-${user.id.slice(-6)}`
    let slug = baseSlug
    const taken = await prisma.organization.findUnique({ where: { slug } })
    if (taken) slug = `personal-${user.id.slice(-8)}`
    const taken2 = await prisma.organization.findUnique({ where: { slug } })
    if (taken2) slug = `personal-${user.id}`
    await prisma.organization.create({
      data: {
        name: user.name,
        slug,
        type: 'personal',
        members: { create: { userId: user.id, role: 'owner' } },
      },
    })
  }

  // Sign session JWT
  const sessionToken = await signSession({ sub: user.id })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  })
  return response
}
