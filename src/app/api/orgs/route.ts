import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgs = await prisma.organization.findMany({
    where: { members: { some: { userId } } },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId }, select: { role: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(orgs)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      members: { create: { userId, role: 'owner' } },
    },
    include: { _count: { select: { members: true } } },
  })
  return NextResponse.json(org, { status: 201 })
}
