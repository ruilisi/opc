import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId, columnId } = await params
  const body = await request.json()
  const data: { name?: string; order?: number } = {}
  if (body.name !== undefined) data.name = body.name
  if (body.order !== undefined) data.order = body.order

  const isMember = await prisma.boardMember.findFirst({ where: { boardId, userId } })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const column = await prisma.column.update({ where: { id: columnId }, data })
  if (body.order !== undefined) {
    emitBoardEvent(boardId, { type: 'column.moved', payload: { columnId, order: column.order } })
  }
  return NextResponse.json(column)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId, columnId } = await params

  const isMember = await prisma.boardMember.findFirst({ where: { boardId, userId, role: 'owner' } })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.boardForm.deleteMany({ where: { columnId } })
  await prisma.column.delete({ where: { id: columnId } })
  return NextResponse.json({ ok: true })
}
