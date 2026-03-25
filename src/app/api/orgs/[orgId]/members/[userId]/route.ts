import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const requesterId = request.headers.get('x-user-id')
  if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, userId } = await params

  const requesterMembership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: requesterId } },
  })
  if (!requesterMembership || requesterMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent removing the last owner
  if (userId === requesterId) {
    const ownerCount = await prisma.orgMember.count({ where: { orgId, role: 'owner' } })
    if (ownerCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last owner' }, { status: 400 })
    }
  }

  await prisma.orgMember.delete({ where: { orgId_userId: { orgId, userId } } })
  return NextResponse.json({ ok: true })
}
