import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

export async function POST(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const form = await prisma.boardForm.findUnique({
    where: { id: formId },
    include: { fields: { orderBy: { order: 'asc' } }, column: { select: { boardId: true } } },
  })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = request.headers.get('x-user-id')
  if (form.status === 'closed') return NextResponse.json({ error: 'This form is closed' }, { status: 403 })
  if (form.status === 'login_required' && !userId) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  const data: Record<string, string> = await request.json()

  // Validate required fields
  for (const field of form.fields) {
    if (field.required && !data[field.id]?.trim()) {
      return NextResponse.json({ error: `"${field.label}" is required` }, { status: 400 })
    }
  }

  // Build task title from first text/email field, fallback to form title
  const titleField = form.fields.find((f) => f.type === 'text' || f.type === 'email')
  const taskTitle = (titleField && data[titleField.id]?.trim()) || form.title

  // Build task content as markdown from all fields
  const taskContent = form.fields
    .filter((f) => data[f.id]?.trim())
    .map((f) => `## ${f.label}\n${data[f.id]}`)
    .join('\n\n')

  const maxOrder = await prisma.task.aggregate({ where: { columnId: form.columnId }, _max: { order: true } })
  const task = await prisma.task.create({
    data: {
      columnId: form.columnId,
      title: taskTitle,
      content: taskContent || null,
      order: (maxOrder._max.order ?? 0) + 1,
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      column: { select: { boardId: true } },
    },
  })

  await prisma.formSubmission.create({ data: { formId, taskId: task.id, data } })

  emitBoardEvent(form.column.boardId, { type: 'task.created', payload: task })

  return NextResponse.json({ ok: true })
}
