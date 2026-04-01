'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, FileText, Search } from 'lucide-react'

interface Doc {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  publicAccess: string | null
  createdBy: { id: string; name: string; avatarUrl: string | null }
  _count: { permissions: number }
}

export default function DocsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/docs`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [orgId])

  async function createDoc() {
    setCreating(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled' }),
      })
      if (!res.ok) throw new Error('Failed')
      const doc = await res.json()
      router.push(`/orgs/${orgId}/docs/${doc.id}`)
    } catch {
      toast.error('Failed to create doc')
      setCreating(false)
    }
  }

  const filtered = docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <h1 className="text-lg font-semibold flex-1">Docs</h1>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-8 w-48" />
          </div>
          <Button size="sm" onClick={createDoc} disabled={creating}>
            <Plus size={13} className="mr-1" />New doc
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-20 text-muted-foreground">
              <FileText size={32} className="opacity-30" />
              <p className="text-sm">{docs.length === 0 ? 'No docs yet. Create one to get started.' : 'No results.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-2xl">
              {filtered.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => router.push(`/orgs/${orgId}/docs/${doc.id}`)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                >
                  <FileText size={16} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                      {doc.publicAccess && <span className="ml-2 text-green-600">• Public</span>}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
