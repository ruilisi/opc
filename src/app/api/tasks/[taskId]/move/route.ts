import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const { columnId, order } = await request.json()
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { ...(columnId && { columnId }), ...(order !== undefined && { order }) },
  })
  return NextResponse.json(task)
}
