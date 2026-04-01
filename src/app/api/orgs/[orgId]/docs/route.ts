import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ orgId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const docs = await prisma.doc.findMany({
    where: {
      orgId,
      OR: [
        { createdById: userId },
        { permissions: { some: { userId } } },
      ],
    },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { permissions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  const { title } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const doc = await prisma.doc.create({
    data: { title: title.trim(), orgId, createdById: userId },
    include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(doc, { status: 201 })
}
