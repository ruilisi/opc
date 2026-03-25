import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userOrgs = await prisma.orgMember.findMany({ where: { userId }, select: { orgId: true } })
  const orgIds = userOrgs.map((m) => m.orgId)

  const boards = await prisma.board.findMany({
    where: {
      OR: [
        { members: { some: { userId } } },
        { orgId: { in: orgIds } },
      ],
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      _count: { select: { columns: true } },
      org: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(boards)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, description, orgId } = await request.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  if (orgId) {
    const membership = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const board = await prisma.board.create({
    data: {
      name,
      description,
      orgId: orgId ?? null,
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
