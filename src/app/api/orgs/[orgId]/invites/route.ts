import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const membership = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!membership || membership.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const expiresInHours: number = typeof body.expiresIn === 'number' ? body.expiresIn : 24
  const maxUses: number | null = typeof body.maxUses === 'number' && body.maxUses > 0 ? body.maxUses : null
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000)

  const invite = await prisma.orgInvite.create({
    data: { orgId, createdBy: userId, expiresAt, ...(maxUses ? { maxUses } : {}) },
  })

  const baseUrl = request.headers.get('origin') ?? ''
  return NextResponse.json({ token: invite.token, url: `${baseUrl}/invite/${invite.token}` }, { status: 201 })
}
