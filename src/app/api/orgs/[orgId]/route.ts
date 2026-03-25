import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const membership = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { role: 'asc' },
      },
    },
  })
  return NextResponse.json({ ...org, myRole: membership.role })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const membership = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!membership || membership.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, slug: rawSlug } = await request.json()
  const updates: { name?: string; slug?: string } = {}
  if (name?.trim()) updates.name = name.trim()
  if (rawSlug?.trim()) {
    const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const taken = await prisma.organization.findFirst({ where: { slug, NOT: { id: orgId } } })
    if (taken) return NextResponse.json({ error: 'slug_taken' }, { status: 409 })
    updates.slug = slug
  }

  const org = await prisma.organization.update({ where: { id: orgId }, data: updates })
  return NextResponse.json(org)
}
