import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ boardId: string; formId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { formId } = await params
  const form = await prisma.boardForm.findUnique({
    where: { id: formId },
    include: { fields: { orderBy: { order: 'asc' } }, column: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
  })
  if (!form) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(form)
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { formId } = await params
  const body = await request.json()

  // Resolve slug: if provided, auto-increment on conflict
  let resolvedSlug: string | null | undefined = undefined
  if (body.slug !== undefined) {
    if (!body.slug) {
      resolvedSlug = null
    } else {
      const base = body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      let candidate = base
      let suffix = 2
      while (true) {
        const existing = await prisma.boardForm.findUnique({ where: { slug: candidate } })
        if (!existing || existing.id === formId) break
        candidate = `${base}-${suffix++}`
      }
      resolvedSlug = candidate
    }
  }

  const form = await prisma.boardForm.update({
    where: { id: formId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.columnId !== undefined && { columnId: body.columnId }),
      ...(body.status !== undefined && { status: body.status }),
      ...(resolvedSlug !== undefined && { slug: resolvedSlug }),
    },
    include: { fields: { orderBy: { order: 'asc' } }, column: { select: { id: true, name: true } }, _count: { select: { submissions: true } } },
  })
  return NextResponse.json(form)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { formId } = await params
  await prisma.boardForm.delete({ where: { id: formId } })
  return new NextResponse(null, { status: 204 })
}
