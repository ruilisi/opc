import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestUserId = request.headers.get('x-user-id')
  if (!requestUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const member = await prisma.taskMember.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId },
    update: {},
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(member, { status: 201 })
}
