import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; sentryOrgId: string; issueId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, sentryOrgId, issueId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sentryOrg = await prisma.sentryOrg.findFirst({ where: { id: sentryOrgId, opcOrgId: orgId } })
  if (!sentryOrg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = await fetch(`https://sentry.io/api/0/issues/${issueId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sentryOrg.authToken}` },
  })

  if (!res.ok && res.status !== 404) {
    return NextResponse.json({ error: `Sentry API error: ${res.status}` }, { status: 502 })
  }

  return new NextResponse(null, { status: 204 })
}
