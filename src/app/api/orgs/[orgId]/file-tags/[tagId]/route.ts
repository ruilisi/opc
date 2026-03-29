import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, tagId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }
  const { name, color } = await request.json()
  if (color && !HEX_COLOR_RE.test(color)) return NextResponse.json({ error: 'color must be #RRGGBB' }, { status: 400 })
  const tag = await prisma.orgFileTag.update({
    where: { id: tagId },
    data: { ...(name && { name }), ...(color && { color }) },
  })
  emitOrgFileEvent(orgId, { type: 'tag.updated', payload: tag })
  return NextResponse.json(tag)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, tagId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }
  await prisma.orgFileTag.delete({ where: { id: tagId } })
  emitOrgFileEvent(orgId, { type: 'tag.deleted', payload: { tagId } })
  return NextResponse.json({ ok: true })
}
