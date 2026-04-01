import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateFormSlug } from '@/lib/slug'

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const forms = await prisma.boardForm.findMany({
    where: { boardId },
    include: { fields: { orderBy: { order: 'asc' } }, column: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(forms)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const { title, description, columnId } = await request.json()
  if (!title || !columnId) return NextResponse.json({ error: 'title and columnId required' }, { status: 400 })
  const slug = await generateFormSlug()
  const form = await prisma.boardForm.create({
    data: { boardId, columnId, title, description, slug },
    include: { fields: true, column: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
  })
  return NextResponse.json(form, { status: 201 })
}
