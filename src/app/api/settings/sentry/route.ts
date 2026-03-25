import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const configs = await prisma.sentryConfig.findMany({ orderBy: { createdAt: 'asc' } })
  return NextResponse.json(configs)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, dsn, orgSlug, projectSlug, authToken } = await request.json()
  const config = await prisma.sentryConfig.create({
    data: { name, dsn, orgSlug, projectSlug, authToken },
  })
  return NextResponse.json(config, { status: 201 })
}
