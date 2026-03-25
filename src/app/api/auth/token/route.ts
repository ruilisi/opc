import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes, createHash } from 'crypto'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(tokens)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await request.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const plainToken = 'opc_' + randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(plainToken).digest('hex')

  await prisma.apiToken.create({ data: { name, tokenHash, userId } })
  return NextResponse.json({ token: plainToken })
}
