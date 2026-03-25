import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; itemId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params
  const { text, checked } = await request.json()
  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(text !== undefined && { text }),
      ...(checked !== undefined && { checked }),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; itemId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params
  await prisma.checklistItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
