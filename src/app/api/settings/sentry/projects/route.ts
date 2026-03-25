import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const orgSlug = searchParams.get('orgSlug')
  const authToken = searchParams.get('authToken')
  if (!orgSlug || !authToken) return NextResponse.json({ error: 'orgSlug and authToken required' }, { status: 400 })

  const res = await fetch(`https://sentry.io/api/0/organizations/${orgSlug}/projects/`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!res.ok) return NextResponse.json({ error: `Sentry error: ${res.status}` }, { status: res.status })

  const projects: { slug: string; name: string; id: string }[] = await res.json()
  return NextResponse.json(projects.map((p) => ({ id: p.id, slug: p.slug, name: p.name })))
}
