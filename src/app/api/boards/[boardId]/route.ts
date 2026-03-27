import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const board = await prisma.board.findFirst({
    where: {
      id: boardId,
      OR: [
        { members: { some: { userId } } },
        { org: { members: { some: { userId } } } },
      ],
    },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
              labels: { include: { label: { select: { id: true, name: true, color: true } } } },
            },
          },
        },
      },
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(board)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const { name, description, basePath } = await request.json()
  const board = await prisma.board.updateMany({
    where: { id: boardId, members: { some: { userId, role: 'owner' } } },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(basePath !== undefined && { basePath }),
    },
  })
  if (board.count === 0) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const result = await prisma.board.deleteMany({
    where: { id: boardId, members: { some: { userId, role: 'owner' } } },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
