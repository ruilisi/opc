import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSentryIssues } from '@/lib/sentry-api'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { configId } = await params
  const config = await prisma.sentryConfig.findUnique({ where: { id: configId } })
  if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const issues = await fetchSentryIssues(config.authToken, config.orgSlug, config.projectSlug)
    return NextResponse.json(issues)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
