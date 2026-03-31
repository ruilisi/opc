'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, ExternalLink, Settings, Trash2, FileText } from 'lucide-react'

interface BoardForm {
  id: string
  title: string
  description: string | null
  status: string
  column: { id: string; name: string }
  _count: { submissions: number }
  createdAt: string
}

interface Column {
  id: string
  name: string
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  login_required: 'Login required',
  closed: 'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'text-green-600 bg-green-500/10',
  login_required: 'text-yellow-600 bg-yellow-500/10',
  closed: 'text-red-600 bg-red-500/10',
}

export default function FormsPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const router = useRouter()
  const [forms, setForms] = useState<BoardForm[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newColumnId, setNewColumnId] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/boards/${boardId}/forms`).then((r) => r.ok ? r.json() : []),
      fetch(`/api/boards/${boardId}/columns`).then((r) => r.ok ? r.json() : []),
    ]).then(([f, c]) => {
      setForms(Array.isArray(f) ? f : [])
      setColumns(Array.isArray(c) ? c : [])
      if (c?.[0]) setNewColumnId(c[0].id)
    }).finally(() => setLoading(false))
  }, [boardId])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newTitle.trim() || !newColumnId) return
    setCreating(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, columnId: newColumnId }),
      })
      if (!res.ok) throw new Error('Failed')
      const form = await res.json()
      setForms((prev) => [form, ...prev])
      setNewTitle('')
      setShowCreate(false)
      router.push(`/boards/${boardId}/forms/${form.id}`)
    } catch {
      toast.error('Failed to create form')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(formId: string) {
    try {
      await fetch(`/api/boards/${boardId}/forms/${formId}`, { method: 'DELETE' })
      setForms((prev) => prev.filter((f) => f.id !== formId))
      toast.success('Form deleted')
    } catch {
      toast.error('Failed to delete form')
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-3xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Forms</h1>
            <p className="text-sm text-muted-foreground mt-1">Collect submissions that create tasks on this board</p>
          </div>
          <Button onClick={() => setShowCreate(true)} size="sm"><Plus size={14} className="mr-1" />New Form</Button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="rounded-lg border p-4 flex flex-col gap-3">
            <p className="text-sm font-medium">New form</p>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Form title"
              autoFocus
              required
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Submissions go to column</label>
              <select
                value={newColumnId}
                onChange={(e) => setNewColumnId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required
              >
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : forms.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center flex flex-col items-center gap-2">
            <FileText size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No forms yet. Create one to start collecting submissions.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {forms.map((form) => (
              <div key={form.id} className="rounded-lg border p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{form.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[form.status] ?? ''}`}>
                      {STATUS_LABELS[form.status] ?? form.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    → {form.column.name} · {form._count.submissions} submission{form._count.submissions !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={`/forms/${form.id}`} target="_blank" rel="noopener noreferrer" title="Open public form"
                    className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink size={14} />
                  </a>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/boards/${boardId}/forms/${form.id}/submissions`)} title="Submissions">
                    <FileText size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/boards/${boardId}/forms/${form.id}`)} title="Edit form">
                    <Settings size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => handleDelete(form.id)} title="Delete">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
