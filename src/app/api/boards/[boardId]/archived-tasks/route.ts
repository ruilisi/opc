import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params

  const isMember = await prisma.boardMember.findFirst({ where: { boardId, userId } })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const tasks = await prisma.task.findMany({
    where: { column: { boardId }, archived: true },
    include: {
      column: { select: { id: true, name: true, boardId: true } },
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      labels: { include: { label: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(tasks)
}
