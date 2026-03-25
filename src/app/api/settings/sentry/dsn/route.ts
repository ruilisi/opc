import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const orgSlug = searchParams.get('orgSlug')
  const projectSlug = searchParams.get('projectSlug')
  const authToken = searchParams.get('authToken')
  if (!orgSlug || !projectSlug || !authToken) {
    return NextResponse.json({ error: 'orgSlug, projectSlug and authToken required' }, { status: 400 })
  }

  const res = await fetch(`https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/keys/`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!res.ok) return NextResponse.json({ dsn: '' })

  const keys: { dsn: { public: string } }[] = await res.json()
  const dsn = keys[0]?.dsn?.public ?? ''
  return NextResponse.json({ dsn })
}
