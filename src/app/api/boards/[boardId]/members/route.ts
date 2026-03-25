import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const { targetUserId, role = 'member' } = await request.json()

  // Only owners can add members
  const membership = await prisma.boardMember.findFirst({
    where: { boardId, userId, role: 'owner' },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const member = await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId, userId: targetUserId } },
    update: { role },
    create: { boardId, userId: targetUserId, role },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(member)
}
