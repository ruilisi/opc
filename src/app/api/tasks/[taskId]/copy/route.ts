import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params

  const original = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      labels: true,
      checklist: { orderBy: { order: 'asc' } },
    },
  })
  if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Compute order for new task (place after all existing tasks in same column)
  const lastTask = await prisma.task.findFirst({
    where: { columnId: original.columnId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  const newOrder = (lastTask?.order ?? 0) + 1000

  const copy = await prisma.task.create({
    data: {
      title: `${original.title} (copy)`,
      content: original.content,
      points: original.points,
      aiModelTag: original.aiModelTag,
      cover: original.cover,
      folderPath: original.folderPath,
      // Don't copy dueDate, members, attachments, comments
      columnId: original.columnId,
      order: newOrder,
      labels: {
        create: original.labels.map((l: { labelId: string }) => ({ labelId: l.labelId })),
      },
      checklist: {
        create: original.checklist.map((item: { text: string; order: number }) => ({
          text: item.text,
          checked: false,
          order: item.order,
        })),
      },
    },
    include: {
      labels: { include: { label: true } },
      checklist: { orderBy: { order: 'asc' } },
      _count: { select: { checklist: true, attachments: true, comments: true } },
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })

  return NextResponse.json(copy)
}
