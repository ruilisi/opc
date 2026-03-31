'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, GripVertical, X, Copy, Check, ArrowLeft } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

interface FormField {
  id?: string
  label: string
  type: string
  required: boolean
  options: string // comma-separated for select
  order: number
}

interface BoardForm {
  id: string
  title: string
  description: string | null
  status: string
  columnId: string
  column: { id: string; name: string }
  fields: Array<{ id: string; label: string; type: string; required: boolean; options: string | null; order: number }>
}

interface Column { id: string; name: string }

const FIELD_TYPES = ['text', 'textarea', 'email', 'number', 'date', 'select', 'phone']

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open (anyone with link)' },
  { value: 'login_required', label: 'Login required' },
  { value: 'closed', label: 'Closed' },
]

let saveTimeout: ReturnType<typeof setTimeout> | null = null

export default function FormBuilderPage() {
  const { boardId, formId } = useParams<{ boardId: string; formId: string }>()
  const router = useRouter()
  const [form, setForm] = useState<BoardForm | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [fields, setFields] = useState<FormField[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('open')
  const [columnId, setColumnId] = useState('')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/boards/${boardId}/forms/${formId}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/boards/${boardId}/columns`).then((r) => r.ok ? r.json() : []),
    ]).then(([f, c]) => {
      if (f) {
        setForm(f)
        setTitle(f.title)
        setDescription(f.description ?? '')
        setStatus(f.status)
        setColumnId(f.columnId)
        setFields(f.fields.map((ff: BoardForm['fields'][0]) => ({
          id: ff.id,
          label: ff.label,
          type: ff.type,
          required: ff.required,
          options: ff.options ?? '',
          order: ff.order,
        })))
      }
      setColumns(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }, [boardId, formId])

  const saveSettings = useCallback(async (patch: object) => {
    await fetch(`/api/boards/${boardId}/forms/${formId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [boardId, formId])

  const saveFields = useCallback(async (fs: FormField[]) => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      const payload = fs.map((f, i) => ({
        label: f.label,
        type: f.type,
        required: f.required,
        options: f.type === 'select' ? f.options : undefined,
        order: i,
      }))
      const res = await fetch(`/api/boards/${boardId}/forms/${formId}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const updated = await res.json()
        setFields(updated.map((ff: BoardForm['fields'][0]) => ({
          id: ff.id, label: ff.label, type: ff.type,
          required: ff.required, options: ff.options ?? '', order: ff.order,
        })))
      }
    }, 600)
  }, [boardId, formId])

  function addField() {
    const next = [...fields, { label: 'New field', type: 'text', required: false, options: '', order: fields.length }]
    setFields(next)
    saveFields(next)
  }

  function updateField(index: number, patch: Partial<FormField>) {
    const next = fields.map((f, i) => i === index ? { ...f, ...patch } : f)
    setFields(next)
    saveFields(next)
  }

  function removeField(index: number) {
    const next = fields.filter((_, i) => i !== index)
    setFields(next)
    saveFields(next)
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return
    const next = [...fields]
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    setFields(next)
    saveFields(next)
  }

  function copyLink() {
    const url = `${window.location.origin}/forms/${formId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <AppShell><div className="p-6 text-muted-foreground text-sm">Loading…</div></AppShell>
  if (!form) return <AppShell><div className="p-6 text-muted-foreground text-sm">Form not found</div></AppShell>

  return (
    <AppShell>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b shrink-0">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/boards/${boardId}/forms`)}>
            <ArrowLeft size={15} />
          </Button>
          <div className="flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => saveSettings({ title })}
              className="h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => router.push(`/boards/${boardId}/forms/${formId}/submissions`)}>
            Submissions
          </Button>
          <Button size="sm" variant="outline" onClick={copyLink}>
            {copied ? <Check size={13} className="mr-1" /> : <Copy size={13} className="mr-1" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: fields */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Form description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => saveSettings({ description })}
                placeholder="Optional description shown to submitters"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Fields</p>
              <Button size="sm" variant="outline" onClick={addField}><Plus size={13} className="mr-1" />Add field</Button>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="fields">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2">
                    {fields.map((field, i) => (
                      <Draggable key={i} draggableId={String(i)} index={i}>
                        {(drag) => (
                          <div ref={drag.innerRef} {...drag.draggableProps} className="rounded-lg border p-3 bg-card flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span {...drag.dragHandleProps} className="text-muted-foreground cursor-grab">
                                <GripVertical size={14} />
                              </span>
                              <Input
                                value={field.label}
                                onChange={(e) => updateField(i, { label: e.target.value })}
                                placeholder="Field label"
                                className="flex-1 h-7 text-sm"
                              />
                              <select
                                value={field.type}
                                onChange={(e) => updateField(i, { type: e.target.value })}
                                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                              >
                                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                                <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                                Required
                              </label>
                              <button onClick={() => removeField(i)} className="text-muted-foreground hover:text-destructive">
                                <X size={14} />
                              </button>
                            </div>
                            {field.type === 'select' && (
                              <div className="pl-6">
                                <Input
                                  value={field.options}
                                  onChange={(e) => updateField(i, { options: e.target.value })}
                                  placeholder="Options (comma-separated): Option A, Option B"
                                  className="h-7 text-xs"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {fields.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">No fields yet. Add one above.</p>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {/* Right: settings */}
          <div className="w-56 shrink-0 border-l overflow-y-auto p-4 flex flex-col gap-5 bg-muted/10">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Column</label>
              <select
                value={columnId}
                onChange={(e) => { setColumnId(e.target.value); saveSettings({ columnId: e.target.value }) }}
                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Submissions create tasks here</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Access</label>
              <div className="flex flex-col gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-accent text-sm">
                    <input
                      type="radio"
                      name="status"
                      value={opt.value}
                      checked={status === opt.value}
                      onChange={() => { setStatus(opt.value); saveSettings({ status: opt.value }) }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Public Link</label>
              <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 bg-muted/30">
                <code className="text-xs flex-1 truncate text-muted-foreground">/forms/{formId}</code>
                <button onClick={copyLink} className="shrink-0 text-muted-foreground hover:text-foreground">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
