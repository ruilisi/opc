import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const tags = await prisma.orgFileTag.findMany({ where: { orgId }, orderBy: { name: 'asc' } })
  return NextResponse.json(tags)
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
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }
  const { name, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (color && !HEX_COLOR_RE.test(color)) return NextResponse.json({ error: 'color must be #RRGGBB' }, { status: 400 })
  const tag = await prisma.orgFileTag.create({ data: { name: name.trim(), color: color ?? '#6366f1', orgId } })
  emitOrgFileEvent(orgId, { type: 'tag.created', payload: tag })
  return NextResponse.json(tag, { status: 201 })
}
