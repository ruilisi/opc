export interface SentryIssue {
  id: string
  title: string
  culprit: string
  count: string
  userCount: number
  firstSeen: string
  lastSeen: string
  permalink: string
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  status: 'unresolved' | 'resolved' | 'ignored'
  platform: string
  shortId: string
  metadata: {
    value?: string
    type?: string
    filename?: string
    function?: string
  }
  stats?: {
    '24h': [number, number][]
  }
  isUnhandled?: boolean
  assignedTo?: { name: string; email: string } | null
}

export async function fetchSentryIssues(
  authToken: string,
  orgSlug: string,
  projectSlug: string
): Promise<SentryIssue[]> {
  const url = `https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/issues/?query=is:unresolved&sort=freq&limit=25&statsPeriod=24h`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!res.ok) throw new Error(`Sentry API error: ${res.status}`)
  return res.json()
}
