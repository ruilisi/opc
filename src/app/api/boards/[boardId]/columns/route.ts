import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const isMember = await prisma.boardMember.findFirst({ where: { boardId, userId } })
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const maxOrder = await prisma.column.aggregate({ where: { boardId }, _max: { order: true } })
  const column = await prisma.column.create({
    data: { name, boardId, order: (maxOrder._max.order ?? 0) + 1 },
  })
  return NextResponse.json(column, { status: 201 })
}
