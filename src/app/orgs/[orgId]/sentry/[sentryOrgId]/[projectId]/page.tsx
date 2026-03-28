'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/shared/AppShell'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import type { SentryIssue } from '@/lib/sentry-api'
import { ArrowLeft, RefreshCw, ExternalLink, User, Zap, Trash2 } from 'lucide-react'

const LEVEL_STYLES: Record<string, string> = {
  fatal: 'bg-red-100 text-red-700 border-red-200',
  error: 'bg-orange-100 text-orange-700 border-orange-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  debug: 'bg-gray-100 text-gray-600 border-gray-200',
}

const LEVEL_DOT: Record<string, string> = {
  fatal: 'bg-red-500',
  error: 'bg-orange-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
  debug: 'bg-gray-400',
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function Sparkline({ points }: { points: [number, number][] }) {
  if (!points || points.length === 0) return null
  const values = points.map(([, v]) => v)
  const max = Math.max(...values, 1)
  const width = 60
  const height = 24
  const step = width / (values.length - 1 || 1)

  const path = values
    .map((v, i) => {
      const x = i * step
      const y = height - (v / max) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="shrink-0 opacity-60">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-400" />
    </svg>
  )
}

export default function SentryIssuesPage() {
  const { orgId, sentryOrgId, projectId } = useParams<{
    orgId: string; sentryOrgId: string; projectId: string
  }>()
  const [issues, setIssues] = useState<SentryIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function deleteIssue(issueId: string) {
    setDeletingId(issueId)
    try {
      const res = await fetch(`/api/orgs/${orgId}/sentry/orgs/${sentryOrgId}/projects/${projectId}/issues/${issueId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setIssues((prev) => prev.filter((i) => i.id !== issueId))
    } finally {
      setDeletingId(null)
    }
  }

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orgs/${orgId}/sentry/orgs/${sentryOrgId}/projects/${projectId}/issues`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? `Error ${res.status}`)
      }
      const data = await res.json()
      setIssues(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load issues')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [orgId, sentryOrgId, projectId])

  // Also load project name
  useEffect(() => {
    fetch(`/api/orgs/${orgId}/sentry/orgs`)
      .then((r) => r.json())
      .then((orgs: { id: string; projects: { id: string; name: string }[] }[]) => {
        const org = orgs.find((o) => o.id === sentryOrgId)
        const proj = org?.projects.find((p) => p.id === projectId)
        if (proj) setProjectName(proj.name)
      })
    load()
  }, [orgId, sentryOrgId, projectId, load])

  return (
    <AppShell>
      <div className="flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href={`/orgs/${orgId}/sentry`} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{projectName || 'Issues'}</h1>
              <p className="text-xs text-muted-foreground">Unresolved · sorted by frequency</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col divide-y">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 px-6 py-4">
                  <Skeleton className="mt-1 size-2 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={() => load()}>Retry</Button>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
              <p className="text-lg font-medium">No issues 🎉</p>
              <p className="text-sm">No unresolved errors in the last 24 hours.</p>
            </div>
          ) : (
            <div className="divide-y">
              {issues.map((issue) => (
                <div key={issue.id} className="group flex items-start gap-4 px-6 py-4 hover:bg-muted/40 transition-colors">
                  {/* Level dot */}
                  <div className={`mt-2 size-2 shrink-0 rounded-full ${LEVEL_DOT[issue.level] ?? LEVEL_DOT.error}`} />

                  {/* Main content */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEVEL_STYLES[issue.level] ?? LEVEL_STYLES.error}`}>
                        {issue.level}
                      </span>
                      {issue.isUnhandled && (
                        <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
                          unhandled
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-mono truncate">{issue.shortId}</span>
                    </div>

                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/link flex items-start gap-1 hover:text-primary"
                    >
                      <span className="font-medium text-sm leading-snug">{issue.title}</span>
                      <ExternalLink size={11} className="mt-0.5 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                    </a>

                    {issue.metadata?.value && (
                      <p className="text-xs text-muted-foreground truncate">{issue.metadata.value}</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {issue.culprit && (
                        <span className="font-mono truncate max-w-xs opacity-70">{issue.culprit}</span>
                      )}
                      <span className="shrink-0">first seen {relativeTime(issue.firstSeen)}</span>
                      <span className="shrink-0">last seen {relativeTime(issue.lastSeen)}</span>
                    </div>
                  </div>

                  {/* Right side: sparkline + stats + delete */}
                  <div className="flex shrink-0 items-center gap-4">
                    {issue.stats?.['24h'] && (
                      <Sparkline points={issue.stats['24h']} />
                    )}
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground min-w-[3rem]">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Zap size={11} />
                        {Number(issue.count).toLocaleString()}
                      </span>
                      {issue.userCount > 0 && (
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {issue.userCount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteIssue(issue.id)}
                      disabled={deletingId === issue.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:opacity-40"
                      title="Delete issue"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer count */}
        {!loading && !error && issues.length > 0 && (
          <div className="border-t px-6 py-2 text-xs text-muted-foreground">
            Showing {issues.length} unresolved issue{issues.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </AppShell>
  )
}
