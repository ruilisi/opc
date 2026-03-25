import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ available: false })
  const existing = await prisma.organization.findUnique({ where: { slug } })
  return NextResponse.json({ available: !existing })
}
