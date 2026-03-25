import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

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

  // One org per owner
  const existing = await prisma.orgMember.findFirst({ where: { userId, role: 'owner' } })
  if (existing) return NextResponse.json({ error: 'You already own an organization' }, { status: 409 })

  const { name, slug: rawSlug } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const slug = rawSlug?.trim() ? toSlug(rawSlug.trim()) : toSlug(name.trim())
  if (!slug) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 })

  const slugTaken = await prisma.organization.findUnique({ where: { slug } })
  if (slugTaken) return NextResponse.json({ error: 'slug_taken', slug }, { status: 409 })

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug,
      members: { create: { userId, role: 'owner' } },
    },
    include: { _count: { select: { members: true } } },
  })
  return NextResponse.json(org, { status: 201 })
}
