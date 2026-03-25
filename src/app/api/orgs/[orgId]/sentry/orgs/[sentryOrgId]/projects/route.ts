import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getSentryOrg(sentryOrgId: string, opcOrgId: string) {
  return prisma.sentryOrg.findFirst({ where: { id: sentryOrgId, opcOrgId } })
}

// List projects available in Sentry (live) and which are already tracked
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; sentryOrgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, sentryOrgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sentryOrg = await getSentryOrg(sentryOrgId, orgId)
  if (!sentryOrg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = await fetch(`https://sentry.io/api/0/organizations/${sentryOrg.orgSlug}/projects/`, {
    headers: { Authorization: `Bearer ${sentryOrg.authToken}` },
  })
  if (!res.ok) return NextResponse.json({ error: `Sentry error: ${res.status}` }, { status: res.status })

  const available: { id: string; slug: string; name: string }[] = await res.json()
  const tracked = await prisma.sentryProject.findMany({ where: { sentryOrgId } })
  const trackedSlugs = new Set(tracked.map((p) => p.projectSlug))

  return NextResponse.json({
    available: available.map((p) => ({ id: p.id, slug: p.slug, name: p.name, tracked: trackedSlugs.has(p.slug) })),
    tracked,
  })
}

// Add (track) a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; sentryOrgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, sentryOrgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sentryOrg = await getSentryOrg(sentryOrgId, orgId)
  if (!sentryOrg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { projectSlug, name } = await request.json()
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug required' }, { status: 400 })

  // Fetch DSN
  let dsn = ''
  try {
    const keysRes = await fetch(
      `https://sentry.io/api/0/projects/${sentryOrg.orgSlug}/${projectSlug}/keys/`,
      { headers: { Authorization: `Bearer ${sentryOrg.authToken}` } }
    )
    if (keysRes.ok) {
      const keys: { dsn: { public: string } }[] = await keysRes.json()
      dsn = keys[0]?.dsn?.public ?? ''
    }
  } catch { /* dsn stays empty */ }

  const project = await prisma.sentryProject.upsert({
    where: { sentryOrgId_projectSlug: { sentryOrgId, projectSlug } },
    create: { sentryOrgId, projectSlug, name: name || projectSlug, dsn },
    update: { name: name || projectSlug, dsn },
  })
  return NextResponse.json(project, { status: 201 })
}
