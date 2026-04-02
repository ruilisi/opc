'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowLeft, Settings, Copy, Check, Trash2, Users } from 'lucide-react'

const DocEditor = dynamic(() => import('@/components/docs/DocEditor'), { ssr: false })

interface DocData {
  id: string
  title: string
  content: string | null
  slug: string | null
  publicAccess: string | null
  myRole: 'owner' | 'editor' | 'viewer'
  createdBy: { id: string; name: string }
  permissions: Array<{ id: string; role: string; user: { id: string; name: string; avatarUrl: string | null } }>
}

interface Props {
  orgId: string
  docId: string
  token: string
}

export default function DocEditorClient({ orgId, docId, token }: Props) {
  const router = useRouter()
  const [doc, setDoc] = useState<DocData | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/docs/${docId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: DocData | null) => {
        if (d) { setDoc(d); setTitle(d.title) }
      })
      .finally(() => setLoading(false))
  }, [orgId, docId])

  async function saveTitle() {
    if (!doc || title === doc.title) return
    const res = await fetch(`/api/orgs/${orgId}/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (res.ok) setDoc((d) => d ? { ...d, title } : d)
  }

  async function setPublicAccess(access: string | null) {
    const res = await fetch(`/api/orgs/${orgId}/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicAccess: access }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDoc(updated)
    }
  }

  async function deleteDoc() {
    if (!confirm('Delete this doc?')) return
    await fetch(`/api/orgs/${orgId}/docs/${docId}`, { method: 'DELETE' })
    router.push(`/orgs/${orgId}/docs`)
  }

  function copyPublicLink() {
    if (!doc?.slug) return
    navigator.clipboard.writeText(`${window.location.origin}/d/${doc.slug}`)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const isOwner = doc?.myRole === 'owner'
  const canEdit = doc?.myRole === 'owner' || doc?.myRole === 'editor'
  const hocuspocusUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? 'ws://localhost:1234'

  if (loading) return <AppShell><div className="p-6 text-muted-foreground text-sm">Loading…</div></AppShell>
  if (!doc) return <AppShell><div className="p-6 text-muted-foreground text-sm">Doc not found</div></AppShell>

  return (
    <AppShell>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/orgs/${orgId}/docs`)}>
            <ArrowLeft size={15} />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            disabled={!isOwner}
            className="flex-1 h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent"
          />
          {isOwner && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowSidebar((v) => !v)}>
              <Settings size={15} />
            </Button>
          )}
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <DocEditor
              docId={docId}
              token={token}
              readOnly={!canEdit}
              hocuspocusUrl={hocuspocusUrl}
            />
          </div>

          {showSidebar && isOwner && (
            <div className="w-60 shrink-0 border-l overflow-y-auto p-4 flex flex-col gap-5 bg-muted/10">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Public Access</p>
                {(['', 'read', 'edit'] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publicAccess"
                      checked={(doc.publicAccess ?? '') === val}
                      onChange={() => setPublicAccess(val || null)}
                    />
                    {val === '' ? 'Private' : val === 'read' ? 'Public (read-only)' : 'Public (editable)'}
                  </label>
                ))}
                {doc.slug && (
                  <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 bg-muted/30 mt-1">
                    <code className="text-xs flex-1 truncate text-muted-foreground">/d/{doc.slug}</code>
                    <button onClick={copyPublicLink} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Users size={11} /> Members ({doc.permissions.length})
                </p>
                {doc.permissions.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{p.user.name}</span>
                    <span className="text-xs text-muted-foreground">{p.role}</span>
                  </div>
                ))}
              </div>

              <Button variant="destructive" size="sm" onClick={deleteDoc} className="mt-auto">
                <Trash2 size={13} className="mr-1" />Delete doc
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
