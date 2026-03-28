import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { columnId, title, content, points, aiModelTag } = await request.json()
  if (!columnId || !title) return NextResponse.json({ error: 'columnId and title required' }, { status: 400 })

  const maxOrder = await prisma.task.aggregate({ where: { columnId }, _max: { order: true } })
  const task = await prisma.task.create({
    data: {
      title,
      content,
      points,
      aiModelTag,
      columnId,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      column: { select: { boardId: true } },
    },
  })
  emitBoardEvent(task.column.boardId, { type: 'task.created', payload: task })
  return NextResponse.json(task, { status: 201 })
}
