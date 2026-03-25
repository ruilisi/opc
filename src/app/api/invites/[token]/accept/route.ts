import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession, COOKIE_NAME } from '@/lib/auth'

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Accept may come without proxy-set header since /api/invites/ is public
  let userId = request.headers.get('x-user-id')
  if (!userId) {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value
    if (sessionToken) {
      const session = await verifySession(sessionToken)
      userId = session?.sub ?? null
    }
  }
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await params
  const invite = await prisma.orgInvite.findUnique({ where: { token } })
  if (!invite) return NextResponse.json({ error: 'Invalid invite' }, { status: 404 })

  const expired = invite.expiresAt && invite.expiresAt < new Date()
  if (expired) return NextResponse.json({ error: 'Invite expired' }, { status: 410 })

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId: invite.orgId, userId } },
    create: { orgId: invite.orgId, userId, role: 'member' },
    update: {},
  })

  const org = await prisma.organization.findUnique({ where: { id: invite.orgId } })
  return NextResponse.json(org)
}
