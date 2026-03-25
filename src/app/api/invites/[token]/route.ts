import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { org: { select: { id: true, name: true } } },
  })

  if (!invite) return NextResponse.json({ valid: false }, { status: 404 })

  const expired = invite.expiresAt && invite.expiresAt < new Date()
  if (expired) return NextResponse.json({ valid: false, reason: 'expired' })

  return NextResponse.json({ valid: true, org: invite.org })
}
