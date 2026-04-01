import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ orgId: string; docId: string }> }

async function assertOwner(docId: string, userId: string) {
  const doc = await prisma.doc.findUnique({ where: { id: docId } })
  if (!doc) return null
  if (doc.createdById !== userId) return null
  return doc
}

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const doc = await prisma.doc.findUnique({ where: { id: docId }, include: { permissions: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (doc.createdById !== userId) {
    const perm = doc.permissions.find(p => p.userId === userId)
    if (!perm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(doc.permissions)
}

export async function POST(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const doc = await assertOwner(docId, userId)
  if (!doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targetUserId, role } = await request.json()
  if (!targetUserId || !['viewer', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'targetUserId and role (viewer|editor) required' }, { status: 400 })
  }
  const perm = await prisma.docPermission.upsert({
    where: { docId_userId: { docId, userId: targetUserId } },
    create: { docId, userId: targetUserId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(perm, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const doc = await assertOwner(docId, userId)
  if (!doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targetUserId } = await request.json()
  await prisma.docPermission.deleteMany({ where: { docId, userId: targetUserId } })
  return new NextResponse(null, { status: 204 })
}
