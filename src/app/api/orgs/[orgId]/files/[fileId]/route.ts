import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFromQiniu } from '@/lib/qiniu'
import { emitOrgFileEvent } from '@/lib/realtime'

const fileInclude = {
  uploader: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: true } },
} as const

async function getFileAndMember(orgId: string, fileId: string, userId: string) {
  const [file, member] = await Promise.all([
    prisma.orgFile.findUnique({ where: { id: fileId }, include: fileInclude }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  return { file, member }
}

function canEdit(member: { role: string } | null, file: { uploaderId: string } | null, userId: string) {
  if (!member || !file) return false
  if (member.role === 'viewer') return false
  if (member.role === 'admin' || member.role === 'owner') return true
  return file.uploaderId === userId
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId } = await params

  const { file, member } = await getFileAndMember(orgId, fileId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (!file || file.orgId !== orgId) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canEdit(member, file, userId)) return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  const body = await request.json()
  const { name, folderId } = body

  if (name === undefined && folderId === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const normalizedFolderId = folderId === '' ? null : folderId

  if (normalizedFolderId !== undefined && normalizedFolderId !== null) {
    const folder = await prisma.orgFolder.findUnique({ where: { id: normalizedFolderId }, select: { orgId: true } })
    if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const updated = await prisma.orgFile.update({
    where: { id: fileId },
    data: {
      ...(name !== undefined && { name }),
      ...(normalizedFolderId !== undefined && { folderId: normalizedFolderId }),
    },
    include: fileInclude,
  })

  if (name !== undefined) emitOrgFileEvent(orgId, { type: 'file.renamed', payload: { fileId, name } })
  if (normalizedFolderId !== undefined) emitOrgFileEvent(orgId, { type: 'file.moved', payload: { fileId, folderId: normalizedFolderId } })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId } = await params

  const { file, member } = await getFileAndMember(orgId, fileId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (!file || file.orgId !== orgId) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canEdit(member, file, userId)) return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  await prisma.orgFile.delete({ where: { id: fileId } })

  // Delete from Qiniu — log errors but don't roll back
  try {
    await deleteFromQiniu(file.key)
  } catch (err) {
    console.error(`[qiniu] Failed to delete key ${file.key}:`, err)
  }

  emitOrgFileEvent(orgId, { type: 'file.deleted', payload: { fileId } })
  return NextResponse.json({ ok: true })
}
