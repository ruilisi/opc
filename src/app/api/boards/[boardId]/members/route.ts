import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { orgId: true } })
  if (!board) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const members = await prisma.orgMember.findMany({
    where: { orgId: board.orgId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(members)
}
