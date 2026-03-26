import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only board-scoped tokens are allowed here
  const boardId = request.headers.get('x-board-token-scope')
  if (!boardId) {
    return NextResponse.json(
      { error: 'This endpoint requires a board agent token, not a user token.' },
      { status: 403 }
    )
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
              labels: { include: { label: { select: { id: true, name: true, color: true } } } },
              checklist: { orderBy: { order: 'asc' } },
              _count: { select: { attachments: true, comments: true } },
            },
          },
        },
      },
    },
  })

  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const apiBase = new URL(request.url).origin + '/api'

  return NextResponse.json({
    board: {
      id: board.id,
      name: board.name,
      description: board.description,
    },
    columns: board.columns.map((col) => ({
      id: col.id,
      name: col.name,
      order: col.order,
      tasks: col.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        content: task.content,
        points: task.points,
        dueDate: task.dueDate,
        cover: task.cover,
        aiModelTag: task.aiModelTag,
        columnId: task.columnId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        members: task.members.map((m) => m.user),
        labels: task.labels.map((l) => l.label),
        checklist: task.checklist,
        _count: task._count,
      })),
    })),
    meta: {
      apiBase,
      auth: 'Authorization: Bearer <your-board-token>',
      actions: {
        getBoardSnapshot: `GET  ${apiBase}/agent`,
        getTask:          `GET  ${apiBase}/tasks/{taskId}`,
        createTask:       `POST ${apiBase}/tasks                              body: { columnId, title, content?, points?, aiModelTag? }`,
        updateTask:       `PATCH ${apiBase}/tasks/{taskId}                   body: { title?, content?, dueDate?, points?, aiModelTag? }`,
        moveTask:         `PATCH ${apiBase}/tasks/{taskId}/move              body: { columnId, order? }`,
        deleteTask:       `DELETE ${apiBase}/tasks/{taskId}`,
        addComment:       `POST ${apiBase}/tasks/{taskId}/comments           body: { content }`,
        updateComment:    `PATCH ${apiBase}/tasks/{taskId}/comments/{commentId}  body: { content }`,
        listComments:     `GET  ${apiBase}/tasks/{taskId}/comments`,
        addChecklistItem: `POST ${apiBase}/tasks/{taskId}/checklist          body: { text }`,
        updateChecklistItem: `PATCH ${apiBase}/tasks/{taskId}/checklist/{itemId}  body: { checked?, text?, order? }`,
        deleteChecklistItem: `DELETE ${apiBase}/tasks/{taskId}/checklist/{itemId}`,
      },
      tips: [
        'Call getBoardSnapshot first to orient yourself — it returns all columns and tasks.',
        'To claim a task: add yourself as a member via addComment or use updateTask to note you are working on it.',
        'To complete a task: move it to the rightmost column using moveTask.',
        'Use addComment to log progress so humans can follow along.',
        'checklist[].checked reflects sub-task progress — tick items as you finish them.',
      ],
    },
  })
}
