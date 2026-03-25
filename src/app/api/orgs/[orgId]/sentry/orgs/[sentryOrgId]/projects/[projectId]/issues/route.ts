import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSentryIssues } from '@/lib/sentry-api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; sentryOrgId: string; projectId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, sentryOrgId, projectId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const project = await prisma.sentryProject.findFirst({ where: { id: projectId, sentryOrgId } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sentryOrg = await prisma.sentryOrg.findFirst({ where: { id: sentryOrgId, opcOrgId: orgId } })
  if (!sentryOrg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const issues = await fetchSentryIssues(sentryOrg.authToken, sentryOrg.orgSlug, project.projectSlug)
    return NextResponse.json(issues)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
