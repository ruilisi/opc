'use client'

import React, { useState, useEffect } from 'react'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Trash2, Plus, Eye, EyeOff } from 'lucide-react'

// ---- Qiniu Settings ----
function QiniuSettings() {
  const [form, setForm] = useState({ accessKey: '', secretKey: '', bucket: '', domain: '', folder: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings/qiniu').then((r) => r.json()).then((d) => { if (d) setForm(d) })
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/settings/qiniu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Qiniu settings saved')
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qiniu Storage</CardTitle>
        <CardDescription>Configure image uploads via Qiniu CDN</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {(['accessKey', 'secretKey', 'bucket', 'domain', 'folder'] as const).map((k) => (
            <div key={k} className="flex flex-col gap-2">
              <Label htmlFor={k}>{k}</Label>
              <Input id={k} value={form[k]} onChange={set(k)} placeholder={k} type={k === 'secretKey' ? 'password' : 'text'} />
            </div>
          ))}
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ---- Sentry Configs ----
interface SentryConfig {
  id: string; name: string; orgSlug: string; projectSlug: string
}
interface SentryProject {
  id: string; slug: string; name: string
}

function SentrySettings() {
  const [configs, setConfigs] = useState<SentryConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  // Step 1 fields
  const [name, setName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [authToken, setAuthToken] = useState('')
  // Step 2
  const [projects, setProjects] = useState<SentryProject[] | null>(null)
  const [selectedSlug, setSelectedSlug] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings/sentry').then((r) => r.json()).then(setConfigs)
  }, [])

  function resetForm() {
    setName(''); setOrgSlug(''); setAuthToken(''); setProjects(null); setSelectedSlug('')
    setShowForm(false)
  }

  async function fetchProjects(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFetching(true)
    try {
      const res = await fetch(`/api/settings/sentry/projects?orgSlug=${encodeURIComponent(orgSlug)}&authToken=${encodeURIComponent(authToken)}`)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      const data: SentryProject[] = await res.json()
      setProjects(data)
      if (data.length > 0) setSelectedSlug(data[0].slug)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally { setFetching(false) }
  }

  async function handleSave() {
    if (!selectedSlug) return
    setSaving(true)
    try {
      // Fetch DSN automatically
      const dsnRes = await fetch(`/api/settings/sentry/dsn?orgSlug=${encodeURIComponent(orgSlug)}&projectSlug=${encodeURIComponent(selectedSlug)}&authToken=${encodeURIComponent(authToken)}`)
      const { dsn } = dsnRes.ok ? await dsnRes.json() : { dsn: '' }

      const res = await fetch('/api/settings/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || selectedSlug, dsn, orgSlug, projectSlug: selectedSlug, authToken }),
      })
      if (!res.ok) throw new Error('Failed')
      const config = await res.json()
      setConfigs((c) => [...c, config])
      resetForm()
      toast.success('Sentry config added')
    } catch { toast.error('Failed to add config') } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/settings/sentry/${id}`, { method: 'DELETE' })
      setConfigs((c) => c.filter((s) => s.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed') }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sentry Configs</CardTitle>
            <CardDescription>Monitor errors across projects</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}><Plus size={14} />Add</Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showForm && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            {projects === null ? (
              // Step 1: credentials
              <form onSubmit={fetchProjects} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="s-name">Config name (optional)</Label>
                  <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Sentry" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="s-org">Organization slug</Label>
                  <Input id="s-org" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="my-org" required />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="s-token">Auth token</Label>
                  <Input id="s-token" value={authToken} onChange={(e) => setAuthToken(e.target.value)} type="password" placeholder="sntrys_..." required />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={fetching}>{fetching ? 'Fetching...' : 'Fetch Projects'}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            ) : (
              // Step 2: pick project
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Found {projects.length} project{projects.length !== 1 ? 's' : ''} in <span className="font-medium text-foreground">{orgSlug}</span></p>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="s-project">Select project</Label>
                  <select
                    id="s-project"
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.slug}>{p.name} ({p.slug})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving || !selectedSlug}>{saving ? 'Saving...' : 'Add Config'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setProjects(null)}>← Back</Button>
                  <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
        {configs.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.orgSlug}/{c.projectSlug}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(c.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {configs.length === 0 && !showForm && <p className="text-sm text-muted-foreground">No Sentry configs yet.</p>}
      </CardContent>
    </Card>
  )
}

// ---- API Tokens ----
interface ApiToken { id: string; name: string; createdAt: string }

function ApiTokenSettings() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [name, setName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    fetch('/api/auth/token').then((r) => r.json()).then((data) => setTokens(Array.isArray(data) ? data : []))
  }, [])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed')
      const { token } = await res.json()
      setNewToken(token)
      setName('')
      fetch('/api/auth/token').then((r) => r.json()).then((data) => setTokens(Array.isArray(data) ? data : []))
    } catch { toast.error('Failed to create token') }
  }

  async function handleRevoke(id: string) {
    try {
      await fetch(`/api/auth/token/${id}`, { method: 'DELETE' })
      setTokens((t) => t.filter((tok) => tok.id !== id))
    } catch { toast.error('Failed') }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Tokens</CardTitle>
        <CardDescription>For CLI and skill access. Tokens are shown only once.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {newToken && (
          <div className="rounded-lg border border-green-500 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-800 mb-2">New token (copy it now — it will not be shown again):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white p-2 text-xs font-mono break-all">
                {showToken ? newToken : '•'.repeat(Math.min(newToken.length, 40))}
              </code>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(newToken); toast.success('Copied') }}>Copy</Button>
            </div>
          </div>
        )}
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Token name" className="flex-1" />
          <Button type="submit" size="sm">Generate</Button>
        </form>
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium text-sm">{t.name}</p>
              <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleRevoke(t.id)}>
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {tokens.length === 0 && <p className="text-sm text-muted-foreground">No tokens yet.</p>}
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="p-6 max-w-2xl flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <QiniuSettings />
        <SentrySettings />
        <ApiTokenSettings />
      </div>
    </AppShell>
  )
}
