import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function checkMember(orgId: string, userId: string) {
  return prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  if (!await checkMember(orgId, userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgs = await prisma.sentryOrg.findMany({
    where: { opcOrgId: orgId },
    include: { projects: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(orgs)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  if (!await checkMember(orgId, userId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, orgSlug, authToken } = await request.json()
  if (!orgSlug?.trim() || !authToken?.trim()) {
    return NextResponse.json({ error: 'orgSlug and authToken required' }, { status: 400 })
  }

  const sentryOrg = await prisma.sentryOrg.upsert({
    where: { opcOrgId_orgSlug: { opcOrgId: orgId, orgSlug: orgSlug.trim() } },
    create: { name: name?.trim() || orgSlug.trim(), orgSlug: orgSlug.trim(), authToken, opcOrgId: orgId },
    update: { name: name?.trim() || orgSlug.trim(), authToken },
    include: { projects: true },
  })
  return NextResponse.json(sentryOrg, { status: 201 })
}
