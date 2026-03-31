import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ boardId: string; formId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { formId } = await params

  const form = await prisma.boardForm.findUnique({
    where: { id: formId },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const submissions = await prisma.formSubmission.findMany({
    where: { formId },
    include: { task: { select: { id: true, title: true, column: { select: { boardId: true } } } } },
    orderBy: { createdAt: 'desc' },
  })

  // CSV export
  if (request.nextUrl.searchParams.get('export') === 'csv') {
    const headers = ['Submitted At', ...form.fields.map((f) => f.label), 'Task']
    const rows = submissions.map((s) => {
      const data = s.data as Record<string, string>
      const taskLink = s.task ? `https://opc.ruilisi.com/boards/${s.task.column.boardId}` : ''
      return [
        new Date(s.createdAt).toISOString(),
        ...form.fields.map((f) => data[f.id] ?? ''),
        taskLink,
      ]
    })
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="submissions-${formId}.csv"`,
      },
    })
  }

  return NextResponse.json({ fields: form.fields, submissions })
}
