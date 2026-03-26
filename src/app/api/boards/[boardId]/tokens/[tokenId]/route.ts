import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; tokenId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId, tokenId } = await params

  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  })
  if (member?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token = await prisma.boardToken.findUnique({ where: { id: tokenId } })
  if (!token || token.boardId !== boardId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.boardToken.delete({ where: { id: tokenId } })
  return new NextResponse(null, { status: 204 })
}
