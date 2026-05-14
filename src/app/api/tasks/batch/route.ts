import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

// POST /api/tasks/batch
// body: { tasks: Array<{ columnId, title, content? }> }
// Returns: { created: Task[], errors: { index, error }[] }
// Requires board-scoped agent token OR user token.
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const tasks: { columnId: string; title: string; content?: string }[] = body.tasks ?? []

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'tasks array is required and must be non-empty' }, { status: 400 })
  }
  if (tasks.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 tasks per batch' }, { status: 400 })
  }

  // Validate all items upfront
  for (let i = 0; i < tasks.length; i++) {
    if (!tasks[i].columnId || !tasks[i].title) {
      return NextResponse.json({ error: `tasks[${i}]: columnId and title are required` }, { status: 400 })
    }
  }

  // Get current max order per column (batch)
  const columnIds = [...new Set(tasks.map((t) => t.columnId))]
  const maxOrders = await prisma.task.groupBy({
    by: ['columnId'],
    where: { columnId: { in: columnIds } },
    _max: { order: true },
  })
  const orderMap: Record<string, number> = {}
  for (const row of maxOrders) {
    orderMap[row.columnId] = row._max.order ?? 0
  }

  const created = []
  const errors = []

  for (let i = 0; i < tasks.length; i++) {
    const { columnId, title, content } = tasks[i]
    try {
      orderMap[columnId] = (orderMap[columnId] ?? 0) + 1
      const task = await prisma.task.create({
        data: {
          title,
          content: content ?? null,
          columnId,
          createdById: userId,
          order: orderMap[columnId],
          priority: 0,
        },
        include: {
          members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          column: { select: { boardId: true } },
        },
      })
      emitBoardEvent(task.column.boardId, { type: 'task.created', payload: task })
      created.push(task)
    } catch (err) {
      errors.push({ index: i, error: String(err) })
    }
  }

  return NextResponse.json({ created, errors }, { status: 201 })
}
