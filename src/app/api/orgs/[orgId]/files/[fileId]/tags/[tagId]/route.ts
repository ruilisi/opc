import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

async function checkAccess(orgId: string, fileId: string, userId: string) {
  const [file, member] = await Promise.all([
    prisma.orgFile.findUnique({ where: { id: fileId }, select: { orgId: true, uploaderId: true } }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  if (!member || !file || file.orgId !== orgId) return null
  if (member.role === 'viewer') return null
  if (member.role === 'admin' || member.role === 'owner') return { file, member }
  if (file.uploaderId !== userId) return null
  return { file, member }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId, tagId } = await params

  const access = await checkAccess(orgId, fileId, userId)
  if (!access) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const tag = await prisma.orgFileTag.findUnique({ where: { id: tagId }, select: { id: true, name: true, color: true, orgId: true } })
  if (!tag || tag.orgId !== orgId) return NextResponse.json({ error: 'Tag not found' }, { status: 404 })

  await prisma.orgFileTagAssignment.upsert({
    where: { fileId_tagId: { fileId, tagId } },
    create: { fileId, tagId },
    update: {},
  })

  emitOrgFileEvent(orgId, { type: 'file.tag_added', payload: { fileId, tag } })
  return NextResponse.json({ tag })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId, tagId } = await params

  const access = await checkAccess(orgId, fileId, userId)
  if (!access) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await prisma.orgFileTagAssignment.deleteMany({ where: { fileId, tagId } })

  emitOrgFileEvent(orgId, { type: 'file.tag_removed', payload: { fileId, tagId } })
  return NextResponse.json({ ok: true })
}
