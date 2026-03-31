import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ boardId: string; formId: string }> }

// PUT replaces all fields in one shot (handles create/update/delete + reorder)
export async function PUT(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { formId } = await params
  const fields: Array<{ id?: string; label: string; type: string; required: boolean; options?: string; order: number }> = await request.json()

  await prisma.$transaction([
    prisma.formField.deleteMany({ where: { formId } }),
    prisma.formField.createMany({
      data: fields.map((f) => ({
        formId,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
        options: f.options ?? null,
        order: f.order,
      })),
    }),
  ])

  const updated = await prisma.formField.findMany({ where: { formId }, orderBy: { order: 'asc' } })
  return NextResponse.json(updated)
}
