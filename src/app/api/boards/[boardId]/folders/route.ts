import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params

  const member = await prisma.boardMember.findFirst({ where: { boardId, userId } })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tasks = await prisma.task.findMany({
    where: { column: { boardId }, folderPath: { not: null } },
    select: { folderPath: true },
  })

  const counts = new Map<string, number>()
  for (const t of tasks) {
    const p = t.folderPath!
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  return NextResponse.json(sorted)
}
