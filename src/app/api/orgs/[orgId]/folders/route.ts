import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const folders = await prisma.orgFolder.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentId: true, createdById: true, createdAt: true, orgId: true },
  })
  return NextResponse.json(folders)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role === 'viewer') return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  const { name, parentId } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  if (parentId) {
    const parent = await prisma.orgFolder.findUnique({ where: { id: parentId }, select: { orgId: true } })
    if (!parent || parent.orgId !== orgId) return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
  }

  const folder = await prisma.orgFolder.create({
    data: { name: name.trim(), orgId, parentId: parentId ?? null, createdById: userId },
    select: { id: true, name: true, parentId: true, createdById: true, createdAt: true, orgId: true },
  })

  emitOrgFileEvent(orgId, { type: 'folder.created', payload: folder })
  return NextResponse.json(folder, { status: 201 })
}
