import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; userId: string }> }
) {
  const requestUserId = request.headers.get('x-user-id')
  if (!requestUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId, userId } = await params
  await prisma.taskMember.delete({ where: { taskId_userId: { taskId, userId } } })
  return NextResponse.json({ ok: true })
}
