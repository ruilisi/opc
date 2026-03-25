import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; labelId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { labelId } = await params
  const { name, color } = await request.json()
  const label = await prisma.label.update({
    where: { id: labelId },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(color && { color }),
    },
  })
  return NextResponse.json(label)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; labelId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { labelId } = await params
  await prisma.label.delete({ where: { id: labelId } })
  return NextResponse.json({ ok: true })
}
