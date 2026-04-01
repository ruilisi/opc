import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDocSlug } from '@/lib/slug'

type Params = { params: Promise<{ orgId: string; docId: string }> }

async function getDocAndCheckAccess(docId: string, userId: string) {
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      permissions: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })
  if (!doc) return null
  if (doc.createdById === userId) return { doc, role: 'owner' as const }
  const perm = doc.permissions.find((p) => p.userId === userId)
  if (!perm) return null
  return { doc, role: perm.role as 'viewer' | 'editor' }
}

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const result = await getDocAndCheckAccess(docId, userId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...result.doc, myRole: result.role })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const result = await getDocAndCheckAccess(docId, userId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // Handle public link slug generation
  let slug = undefined as string | null | undefined
  if (body.publicAccess !== undefined) {
    if (!body.publicAccess) {
      slug = null
    } else if (!result.doc.slug) {
      slug = await generateDocSlug()
    }
  }

  const doc = await prisma.doc.update({
    where: { id: docId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.publicAccess !== undefined && { publicAccess: body.publicAccess || null }),
      ...(slug !== undefined && { slug }),
    },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      permissions: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })
  return NextResponse.json({ ...doc, myRole: 'owner' })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const result = await getDocAndCheckAccess(docId, userId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.doc.delete({ where: { id: docId } })
  return new NextResponse(null, { status: 204 })
}
