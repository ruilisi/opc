import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params
  const form = await prisma.boardForm.findUnique({
    where: { id: formId },
    include: { fields: { orderBy: { order: 'asc' } } },
  })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const userId = request.headers.get('x-user-id')
  if (form.status === 'closed') return NextResponse.json({ error: 'This form is closed' }, { status: 403 })
  if (form.status === 'login_required' && !userId) return NextResponse.json({ error: 'Login required' }, { status: 401 })

  return NextResponse.json({ id: form.id, title: form.title, description: form.description, fields: form.fields })
}
