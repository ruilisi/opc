import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId, columnId } = await params
  const { targetColumnId } = await request.json()
  if (!targetColumnId) return NextResponse.json({ error: 'targetColumnId required' }, { status: 400 })

  const isMember = await prisma.boardMember.findFirst({ where: { boardId, userId } })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const targetTasks = await prisma.task.findMany({
    where: { columnId: targetColumnId, archived: false },
    orderBy: { order: 'asc' },
    select: { order: true },
  })
  const maxOrder = targetTasks[targetTasks.length - 1]?.order ?? 0

  const sourceTasks = await prisma.task.findMany({
    where: { columnId, archived: false },
    orderBy: { order: 'asc' },
  })

  const updated = await Promise.all(
    sourceTasks.map((task, i) =>
      prisma.task.update({
        where: { id: task.id },
        data: { columnId: targetColumnId, order: maxOrder + (i + 1) * 1000 },
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
          _count: { select: { checklist: true, attachments: true, comments: true } },
        },
      })
    )
  )

  emitBoardEvent(boardId, {
    type: 'column.tasksMoved',
    payload: { fromColumnId: columnId, toColumnId: targetColumnId, tasks: updated },
  })

  return NextResponse.json({ tasks: updated })
}
