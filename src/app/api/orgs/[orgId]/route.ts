import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const membership = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { role: 'asc' },
      },
    },
  })
  return NextResponse.json(org)
}
