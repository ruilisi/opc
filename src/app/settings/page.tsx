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

function SentrySettings() {
  const [configs, setConfigs] = useState<SentryConfig[]>([])
  const [form, setForm] = useState({ name: '', dsn: '', orgSlug: '', projectSlug: '', authToken: '' })
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/settings/sentry').then((r) => r.json()).then(setConfigs)
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      const res = await fetch('/api/settings/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      const config = await res.json()
      setConfigs((c) => [...c, config])
      setShowForm(false)
      setForm({ name: '', dsn: '', orgSlug: '', projectSlug: '', authToken: '' })
      toast.success('Sentry config added')
    } catch { toast.error('Failed to add config') }
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
          <form onSubmit={handleAdd} className="flex flex-col gap-3 rounded-lg border p-4">
            {(['name', 'dsn', 'orgSlug', 'projectSlug', 'authToken'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <Label htmlFor={`s-${k}`}>{k}</Label>
                <Input id={`s-${k}`} value={form[k]} onChange={set(k)} placeholder={k} type={k === 'authToken' ? 'password' : 'text'} required />
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="submit" size="sm">Add Config</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
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
