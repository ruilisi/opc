import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: { id: true, title: true, content: true, publicAccess: true, slug: true },
  })
  if (!doc || !doc.publicAccess) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(doc)
}
