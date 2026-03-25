'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, ChevronRight, ExternalLink, Bug } from 'lucide-react'

interface SentryProject {
  id: string
  name: string
  projectSlug: string
  dsn: string
}

interface SentryOrgItem {
  id: string
  name: string
  orgSlug: string
  projects: SentryProject[]
}

interface AvailableProject {
  id: string
  slug: string
  name: string
  tracked: boolean
}

export default function OrgSentryPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [sentryOrgs, setSentryOrgs] = useState<SentryOrgItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', orgSlug: '', authToken: '' })
  const [addingOrg, setAddingOrg] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [availableProjects, setAvailableProjects] = useState<Record<string, AvailableProject[]>>({})
  const [loadingProjects, setLoadingProjects] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/sentry/orgs`)
      .then((r) => r.json())
      .then(setSentryOrgs)
      .finally(() => setLoading(false))
  }, [orgId])

  async function addOrg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddingOrg(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/sentry/orgs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      const org = await res.json()
      setSentryOrgs((prev) => [...prev, org])
      setAddForm({ name: '', orgSlug: '', authToken: '' })
      setShowAddOrg(false)
      toast.success('Sentry organization added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally { setAddingOrg(false) }
  }

  async function deleteOrg(sentryOrgId: string) {
    await fetch(`/api/orgs/${orgId}/sentry/orgs/${sentryOrgId}`, { method: 'DELETE' })
    setSentryOrgs((prev) => prev.filter((o) => o.id !== sentryOrgId))
    toast.success('Removed')
  }

  async function toggleExpand(sentryOrgId: string) {
    const next = !expanded[sentryOrgId]
    setExpanded((prev) => ({ ...prev, [sentryOrgId]: next }))
    if (next && !availableProjects[sentryOrgId]) {
      await loadProjects(sentryOrgId)
    }
  }

  async function loadProjects(sentryOrgId: string) {
    setLoadingProjects((prev) => ({ ...prev, [sentryOrgId]: true }))
    try {
      const res = await fetch(`/api/orgs/${orgId}/sentry/orgs/${sentryOrgId}/projects`)
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data: { available: AvailableProject[] } = await res.json()
      setAvailableProjects((prev) => ({ ...prev, [sentryOrgId]: data.available }))
    } catch { toast.error('Failed to load projects') }
    finally { setLoadingProjects((prev) => ({ ...prev, [sentryOrgId]: false })) }
  }

  async function trackProject(sentryOrgId: string, slug: string, name: string) {
    const res = await fetch(`/api/orgs/${orgId}/sentry/orgs/${sentryOrgId}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectSlug: slug, name }),
    })
    if (!res.ok) { toast.error('Failed'); return }
    const project: SentryProject = await res.json()
    setSentryOrgs((prev) => prev.map((o) => o.id === sentryOrgId ? { ...o, projects: [...o.projects, project] } : o))
    setAvailableProjects((prev) => ({
      ...prev,
      [sentryOrgId]: (prev[sentryOrgId] ?? []).map((p) => p.slug === slug ? { ...p, tracked: true } : p),
    }))
    toast.success(`Tracking ${name}`)
  }

  async function untrackProject(sentryOrgId: string, projectId: string, projectSlug: string) {
    await fetch(`/api/orgs/${orgId}/sentry/orgs/${sentryOrgId}/projects/${projectId}`, { method: 'DELETE' })
    setSentryOrgs((prev) => prev.map((o) => o.id === sentryOrgId ? { ...o, projects: o.projects.filter((p) => p.id !== projectId) } : o))
    setAvailableProjects((prev) => ({
      ...prev,
      [sentryOrgId]: (prev[sentryOrgId] ?? []).map((p) => p.slug === projectSlug ? { ...p, tracked: false } : p),
    }))
    toast.success('Removed')
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sentry</h1>
            <p className="text-sm text-muted-foreground">Track errors across your projects</p>
          </div>
          <Button size="sm" onClick={() => setShowAddOrg(!showAddOrg)}>
            <Plus size={14} /> Add Sentry Org
          </Button>
        </div>

        {showAddOrg && (
          <Card>
            <CardHeader><CardTitle className="text-base">Add Sentry Organization</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={addOrg} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="sname">Display name (optional)</Label>
                  <Input id="sname" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="My Company" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="slug">Organization slug</Label>
                  <Input id="slug" value={addForm.orgSlug} onChange={(e) => setAddForm((f) => ({ ...f, orgSlug: e.target.value }))} placeholder="my-org" required />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="token">Auth token</Label>
                  <Input id="token" type="password" value={addForm.authToken} onChange={(e) => setAddForm((f) => ({ ...f, authToken: e.target.value }))} placeholder="sntrys_..." required />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={addingOrg}>{addingOrg ? 'Adding...' : 'Add'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddOrg(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : sentryOrgs.length === 0 && !showAddOrg ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <p>No Sentry organizations yet.</p>
            <p className="text-sm">Add one to start tracking errors.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sentryOrgs.map((so) => (
              <Card key={so.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <button
                      className="flex items-center gap-2 text-left font-medium hover:text-primary"
                      onClick={() => toggleExpand(so.id)}
                    >
                      {expanded[so.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>{so.name}</span>
                      <span className="text-xs text-muted-foreground font-normal">({so.orgSlug})</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{so.projects.length} tracked</span>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deleteOrg(so.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {expanded[so.id] && (
                  <CardContent className="flex flex-col gap-3">
                    {/* Tracked projects */}
                    {so.projects.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tracked Projects</p>
                        {so.projects.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <Link
                              href={`/orgs/${orgId}/sentry/${so.id}/${p.id}`}
                              className="flex items-center gap-2 hover:text-primary flex-1 min-w-0"
                            >
                              <Bug size={13} className="shrink-0 text-muted-foreground" />
                              <span className="text-sm font-medium">{p.name}</span>
                              <span className="text-xs text-muted-foreground">{p.projectSlug}</span>
                            </Link>
                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={`https://sentry.io/organizations/${so.orgSlug}/projects/${p.projectSlug}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1 text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink size={13} />
                              </a>
                              <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => untrackProject(so.id, p.id, p.projectSlug)}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Available projects from Sentry */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All Projects</p>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => loadProjects(so.id)}>
                          Refresh
                        </Button>
                      </div>
                      {loadingProjects[so.id] ? (
                        <Skeleton className="h-10 rounded-md" />
                      ) : availableProjects[so.id] ? (
                        availableProjects[so.id].filter((p) => !p.tracked).length === 0 ? (
                          <p className="text-sm text-muted-foreground">All projects are already tracked.</p>
                        ) : (
                          availableProjects[so.id].filter((p) => !p.tracked).map((p) => (
                            <div key={p.id} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{p.name}</span>
                                <span className="text-xs text-muted-foreground">{p.slug}</span>
                              </div>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => trackProject(so.id, p.slug, p.name)}>
                                Track
                              </Button>
                            </div>
                          ))
                        )
                      ) : (
                        <p className="text-xs text-muted-foreground">Click the org name to load projects.</p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
