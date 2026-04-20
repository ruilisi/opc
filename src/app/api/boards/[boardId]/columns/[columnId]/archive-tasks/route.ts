import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitBoardEvent } from '@/lib/realtime'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; columnId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId, columnId } = await params

  const isMember = await prisma.boardMember.findFirst({ where: { boardId, userId } })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.task.updateMany({ where: { columnId, archived: false }, data: { archived: true } })
  emitBoardEvent(boardId, { type: 'column.tasksArchived', payload: { columnId } })
  return NextResponse.json({ ok: true })
}
