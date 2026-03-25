import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const boards = await prisma.board.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { columns: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(boards)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description } = await request.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const board = await prisma.board.create({
    data: {
      name,
      description,
      members: { create: { userId, role: 'owner' } },
      columns: {
        createMany: {
          data: [
            { name: 'To Do', order: 1 },
            { name: 'In Progress', order: 2 },
            { name: 'Done', order: 3 },
          ],
        },
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })
  return NextResponse.json(board, { status: 201 })
}
