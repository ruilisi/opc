import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

function canEditFolder(role: string, createdById: string, userId: string) {
  if (role === 'viewer' || role === 'member') return createdById === userId
  return true // admin or owner
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; folderId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, folderId } = await params

  const [folder, member] = await Promise.all([
    prisma.orgFolder.findUnique({ where: { id: folderId } }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canEditFolder(member.role, folder.createdById, userId)) {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }

  const { name, parentId } = await request.json()

  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
  }

  if (parentId !== undefined && parentId !== null) {
    const parent = await prisma.orgFolder.findUnique({ where: { id: parentId }, select: { orgId: true } })
    if (!parent || parent.orgId !== orgId) return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
  }

  const updated = await prisma.orgFolder.update({
    where: { id: folderId },
    data: {
      ...(name !== undefined && { name }),
      ...(parentId !== undefined && { parentId: parentId ?? null }),
    },
    select: { id: true, name: true, parentId: true, createdById: true, createdAt: true, orgId: true },
  })

  if (name !== undefined) emitOrgFileEvent(orgId, { type: 'folder.renamed', payload: { folderId, name } })
  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; folderId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, folderId } = await params

  const [folder, member] = await Promise.all([
    prisma.orgFolder.findUnique({ where: { id: folderId } }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }

  // Collect all descendant folder IDs recursively
  async function getDescendantIds(id: string): Promise<string[]> {
    const children = await prisma.orgFolder.findMany({ where: { parentId: id }, select: { id: true } })
    const nested = await Promise.all(children.map((c) => getDescendantIds(c.id)))
    return [id, ...children.map((c) => c.id), ...nested.flat()]
  }

  const allIds = await getDescendantIds(folderId)

  // Fetch affected file IDs before deletion
  const affectedFiles = await prisma.orgFile.findMany({
    where: { folderId: { in: allIds } },
    select: { id: true },
  })

  await prisma.$transaction([
    // Move files to root
    prisma.orgFile.updateMany({ where: { folderId: { in: allIds } }, data: { folderId: null } }),
    // Delete all folders
    prisma.orgFolder.deleteMany({ where: { id: { in: allIds } } }),
  ])

  emitOrgFileEvent(orgId, { type: 'folder.deleted', payload: { folderId } })
  // Emit file.moved for all affected files
  for (const f of affectedFiles) {
    emitOrgFileEvent(orgId, { type: 'file.moved', payload: { fileId: f.id, folderId: null } })
  }
  return NextResponse.json({ ok: true })
}
