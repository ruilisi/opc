import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const { text } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const max = await prisma.checklistItem.aggregate({ where: { taskId }, _max: { order: true } })
  const item = await prisma.checklistItem.create({
    data: { taskId, text: text.trim(), order: (max._max.order ?? 0) + 1 },
  })
  return NextResponse.json(item, { status: 201 })
}
