import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      labels: { include: { label: true } },
      checklist: { orderBy: { order: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
      comments: {
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
      column: { select: { id: true, name: true, boardId: true } },
    },
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const body = await request.json()
  const { title, content, points, aiModelTag, dueDate, cover, folderPath } = body
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(points !== undefined && { points }),
      ...(aiModelTag !== undefined && { aiModelTag }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(cover !== undefined && { cover }),
      ...(folderPath !== undefined && { folderPath }),
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      labels: { include: { label: true } },
      checklist: { orderBy: { order: 'asc' } },
      attachments: { orderBy: { createdAt: 'asc' } },
      column: { select: { boardId: true } },
    },
  })
  emitBoardEvent(task.column.boardId, { type: 'task.updated', payload: task })
  return NextResponse.json(task)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { column: { select: { boardId: true } } } })
  await prisma.task.delete({ where: { id: taskId } })
  if (task) emitBoardEvent(task.column.boardId, { type: 'task.deleted', payload: { taskId } })
  return NextResponse.json({ ok: true })
}
