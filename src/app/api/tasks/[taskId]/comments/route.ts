import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const comments = await prisma.taskComment.findMany({
    where: { taskId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(comments)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const { content } = await request.json()
  if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })
  const comment = await prisma.taskComment.create({
    data: { content, taskId, authorId: userId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(comment, { status: 201 })
}
