import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const labels = await prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } })
  return NextResponse.json(labels)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const { name, color } = await request.json()
  if (!name?.trim() || !color) return NextResponse.json({ error: 'name and color required' }, { status: 400 })
  const label = await prisma.label.create({ data: { name: name.trim(), color, boardId } })
  return NextResponse.json(label, { status: 201 })
}
