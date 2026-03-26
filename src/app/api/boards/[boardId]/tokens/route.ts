import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

async function requireOwner(boardId: string, userId: string) {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  })
  return member?.role === 'owner'
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params

  if (!(await requireOwner(boardId, userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tokens = await prisma.boardToken.findMany({
    where: { boardId },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tokens)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { boardId } = await params

  if (!(await requireOwner(boardId, userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const plaintext = 'opc_board_' + randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(plaintext).digest('hex')

  const token = await prisma.boardToken.create({
    data: { name: name.trim(), tokenHash, boardId },
    select: { id: true, name: true, createdAt: true },
  })

  return NextResponse.json({ ...token, token: plaintext }, { status: 201 })
}
