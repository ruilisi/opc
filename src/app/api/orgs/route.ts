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
  // Sort: personal first, then enterprise
  const sorted = [...orgs].sort((a, b) => {
    if (a.type === 'personal' && b.type !== 'personal') return -1
    if (a.type !== 'personal' && b.type === 'personal') return 1
    return 0
  })
  return NextResponse.json(sorted)
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Max two enterprise orgs per owner
  const existingCount = await prisma.orgMember.count({ where: { userId, role: 'owner', org: { type: 'enterprise' } } })
  if (existingCount >= 2) return NextResponse.json({ error: 'You can own at most 2 organizations' }, { status: 409 })

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
      type: 'enterprise',
      members: { create: { userId, role: 'owner' } },
    },
    include: { _count: { select: { members: true } } },
  })
  return NextResponse.json(org, { status: 201 })
}
