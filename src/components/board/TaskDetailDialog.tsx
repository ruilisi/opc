'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import MarkdownEditor from '@/components/editor/MarkdownEditor'
import UserAvatar from '@/components/shared/UserAvatar'
import { toast } from 'sonner'
import { Send, Plus, Check, X, Paperclip, Folder, FolderOpen, ChevronRight, ArrowLeft, Trash2, Copy } from 'lucide-react'
import type { Task, ChecklistItem, Attachment, TaskMember, TaskLabel } from '@/types'
import { useBoardSubscription } from '@/lib/hooks/useBoardSubscription'

interface BoardMemberUser {
  id: string
  name: string
  avatarUrl?: string | null
}

interface BoardLabel {
  id: string
  name: string
  color: string
}

interface Props {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (task: Task) => void
  // Create mode: provide columnId + boardId instead of taskId
  columnId?: string | null
  boardId?: string | null
  onCreated?: (task: Task) => void
  onDeleted?: (taskId: string) => void
}

function NewLabelForm({ boardId, onCreated }: { boardId: string; onCreated: (label: BoardLabel) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  async function create() {
    if (!name.trim()) return
    const res = await fetch(`/api/boards/${boardId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    if (!res.ok) return
    const label = await res.json()
    onCreated(label)
    setName('')
  }

  return (
    <div className="border-t mt-1 pt-2 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground px-1">New label</p>
      <div className="flex gap-1">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="size-7 cursor-pointer rounded border p-0.5" />
        <Input value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }}
          placeholder="Label name" className="h-7 text-xs flex-1" />
        <Button size="sm" className="h-7 px-2 text-xs" onClick={create}>+</Button>
      </div>
    </div>
  )
}

export default function TaskDetailDialog({ taskId, open, onOpenChange, onUpdated, columnId, boardId, onCreated, onDeleted }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [points, setPoints] = useState('')
  const [aiModelTag, setAiModelTag] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [cover, setCover] = useState('')
  const [folderPath, setFolderPath] = useState('')
  const [folderSuggestions, setFolderSuggestions] = useState<{ path: string; count: number }[]>([])
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [boardBasePath, setBoardBasePath] = useState<string | null>(null)
  const folderPickerRef = useRef<HTMLDivElement>(null)
  const [fsBrowserOpen, setFsBrowserOpen] = useState(false)
  const [fsBrowsePath, setFsBrowsePath] = useState<string>('')
  const [fsBrowseEntries, setFsBrowseEntries] = useState<string[]>([])
  const [fsBrowseParent, setFsBrowseParent] = useState<string | null>(null)
  const [fsBrowseLoading, setFsBrowseLoading] = useState(false)
  const [members, setMembers] = useState<TaskMember[]>([])
  const [labels, setLabels] = useState<TaskLabel[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [commentText, setCommentText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [boardMembers, setBoardMembers] = useState<BoardMemberUser[]>([])
  const [boardLabels, setBoardLabels] = useState<BoardLabel[]>([])
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
  const [labelPickerOpen, setLabelPickerOpen] = useState(false)
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const memberPickerRef = useRef<HTMLDivElement>(null)
  const labelPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setConfirmDelete(false)

    if (!taskId) {
      // Create mode — reset fields and load board data
      setTask(null)
      setTitle('')
      setContent('')
      setPoints('')
      setAiModelTag('')
      setDueDate('')
      setCover('')
      setFolderPath('')
      setMembers([])
      setLabels([])
      setChecklist([])
      setAttachments([])
      if (boardId) {
        Promise.all([
          fetch(`/api/boards/${boardId}/members`).then((r) => r.json()),
          fetch(`/api/boards/${boardId}/labels`).then((r) => r.json()),
          fetch(`/api/boards/${boardId}`).then((r) => r.json()),
        ]).then(([bm, bl, board]) => {
          setBoardMembers(bm.map((m: { user: BoardMemberUser }) => m.user))
          setBoardLabels(bl)
          setBoardBasePath(board.basePath ?? null)
        })
      }
      return
    }

    setLoading(true)
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((t) => {
        setTask(t)
        setTitle(t.title)
        setContent(t.content ?? '')
        setPoints(t.points?.toString() ?? '')
        setAiModelTag(t.aiModelTag ?? '')
        setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '')
        setCover(t.cover ?? '')
        setFolderPath(t.folderPath ?? '')
        setMembers(t.members ?? [])
        setLabels(t.labels ?? [])
        setChecklist(t.checklist ?? [])
        setAttachments(t.attachments ?? [])

        if (t.column?.boardId) {
          Promise.all([
            fetch(`/api/boards/${t.column.boardId}/members`).then((r) => r.json()),
            fetch(`/api/boards/${t.column.boardId}/labels`).then((r) => r.json()),
            fetch(`/api/boards/${t.column.boardId}`).then((r) => r.json()),
          ]).then(([bm, bl, board]) => {
            setBoardMembers(bm.map((m: { user: BoardMemberUser }) => m.user))
            setBoardLabels(bl)
            setBoardBasePath(board.basePath ?? null)
          })
        }
      })
      .finally(() => setLoading(false))
  }, [taskId, boardId, open])

  const effectiveBoardId = boardId || task?.column?.boardId || ''
  useBoardSubscription(effectiveBoardId, {
    onCommentAdded: (cTaskId, comment) => {
      if (cTaskId !== taskId) return
      setTask((t) => {
        if (!t) return t
        const comments = (t.comments ?? []) as Array<{ id: string }>
        if (comments.some((c) => c.id === comment.id)) return t
        return { ...t, comments: [...comments, comment] }
      })
    },
    onTaskUpdated: (updated) => {
      if (updated.id !== taskId) return
      setTask((t) => t ? { ...t, ...updated } : t)
    },
  })

  // Close pickers on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (memberPickerRef.current && !memberPickerRef.current.contains(e.target as Node)) setMemberPickerOpen(false)
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) setLabelPickerOpen(false)
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) setFolderPickerOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSave() {
    if (!title.trim()) return

    // Create mode
    if (!task && columnId) {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            columnId,
            title,
            content: content || undefined,
            points: points ? parseInt(points) : undefined,
            aiModelTag: aiModelTag || undefined,
            dueDate: dueDate || undefined,
            cover: cover || undefined,
            folderPath: folderPath.trim() || undefined,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const created = await res.json()
        setTask(created)
        onCreated?.({ ...created, members, labels, checklist, attachments })
      } catch {
        toast.error('Failed to create task')
      }
      return
    }

    if (!task) return
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          points: points ? parseInt(points) : null,
          aiModelTag: aiModelTag || null,
          dueDate: dueDate || null,
          cover: cover || null,
          folderPath: folderPath.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setTask((t) => t ? { ...t, ...updated } : t)
      onUpdated({ ...updated, members, labels, checklist, attachments })
    } catch {
      toast.error('Failed to save task')
    }
  }

  async function toggleMember(user: BoardMemberUser) {
    if (!task) return
    const isMember = members.some((m) => m.user.id === user.id)
    let nextMembers: TaskMember[]
    if (isMember) {
      await fetch(`/api/tasks/${task.id}/members/${user.id}`, { method: 'DELETE' })
      nextMembers = members.filter((m) => m.user.id !== user.id)
    } else {
      await fetch(`/api/tasks/${task.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      nextMembers = [...members, { user }]
    }
    setMembers(nextMembers)
    onUpdated({ ...task, members: nextMembers, labels, checklist, attachments })
  }

  async function toggleLabel(label: BoardLabel) {
    if (!task) return
    const hasLabel = labels.some((l) => l.label.id === label.id)
    if (hasLabel) {
      await fetch(`/api/tasks/${task.id}/labels/${label.id}`, { method: 'DELETE' })
      setLabels((prev) => prev.filter((l) => l.label.id !== label.id))
    } else {
      await fetch(`/api/tasks/${task.id}/labels/${label.id}`, { method: 'POST' })
      setLabels((prev) => [...prev, { label }])
    }
  }

  async function addChecklistItem() {
    if (!newChecklistItem.trim() || !task) return
    const res = await fetch(`/api/tasks/${task.id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newChecklistItem }),
    })
    const item = await res.json()
    setChecklist((prev) => [...prev, item])
    setNewChecklistItem('')
  }

  async function toggleChecklistItem(itemId: string, checked: boolean) {
    if (!task) return
    await fetch(`/api/tasks/${task.id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked }),
    })
    setChecklist((prev) => prev.map((i) => i.id === itemId ? { ...i, checked } : i))
  }

  async function deleteChecklistItem(itemId: string) {
    if (!task) return
    await fetch(`/api/tasks/${task.id}/checklist/${itemId}`, { method: 'DELETE' })
    setChecklist((prev) => prev.filter((i) => i.id !== itemId))
  }

  async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !task) return
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: 'POST', body: formData })
    if (!res.ok) { toast.error('Upload failed'); return }
    const attachment = await res.json()
    setAttachments((prev) => [...prev, attachment])
    e.target.value = ''
  }

  async function deleteAttachment(attachmentId: string) {
    if (!task) return
    const attachment = attachments.find((a) => a.id === attachmentId)
    await fetch(`/api/tasks/${task.id}/attachments/${attachmentId}`, { method: 'DELETE' })
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    // If the deleted attachment was set as cover, clear it
    if (attachment && cover === attachment.url) {
      setCover('')
      setTimeout(handleSave, 0)
    }
  }

  async function browseTo(path: string) {
    setFsBrowseLoading(true)
    try {
      const res = await fetch(`/api/fs/browse?path=${encodeURIComponent(path)}`)
      if (!res.ok) return
      const data = await res.json()
      setFsBrowsePath(data.path)
      setFsBrowseEntries(data.entries)
      setFsBrowseParent(data.parent)
    } finally {
      setFsBrowseLoading(false)
    }
  }

  function openFsBrowser() {
    const startPath = boardBasePath || '~'
    setFsBrowserOpen(true)
    setFolderPickerOpen(false)
    browseTo(startPath)
  }

  function selectBrowsedFolder(absPath: string) {
    // Store relative path if inside basePath, else absolute
    if (boardBasePath && absPath.startsWith(boardBasePath)) {
      const rel = absPath.slice(boardBasePath.length).replace(/^\//, '')
      setFolderPath(rel || '.')
    } else {
      setFolderPath(absPath)
    }
    setFsBrowserOpen(false)
    setTimeout(handleSave, 0)
  }

  async function fetchFolderSuggestions() {
    if (!task?.column?.boardId) return
    try {
      const res = await fetch(`/api/boards/${task.column.boardId}/folders`)
      if (res.ok) setFolderSuggestions(await res.json())
    } catch { /* ignore */ }
  }

  async function handleDuplicate() {
    if (!task) return
    try {
      const res = await fetch(`/api/tasks/${task.id}/copy`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const copy = await res.json()
      onCreated?.(copy)
      toast.success('Card duplicated')
    } catch {
      toast.error('Failed to duplicate card')
    }
  }

  async function handleDelete() {
    if (!task) return
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      onOpenChange(false)
      onDeleted?.(task.id)
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
    }
  }

  async function handleComment() {
    if (!task || !commentText.trim()) return
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText }),
      })
      if (!res.ok) throw new Error('Failed')
      const comment = await res.json()
      setTask((t) => t ? { ...t, comments: [...(t.comments ?? []), comment] } : t)
      setCommentText('')
    } catch {
      toast.error('Failed to add comment')
    }
  }

  const COVER_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']
  const checkedCount = checklist.filter((i) => i.checked).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[900px] w-full max-h-[90vh] p-0 flex flex-col overflow-hidden gap-0"
      >
        {loading ? (
          <div className="flex flex-col gap-4 p-8">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (task || (!task && columnId)) ? (
          <>
            {/* Cover — full-width banner */}
            {cover && (
              cover.startsWith('http')
                ? <img src={cover} alt="Card cover" className="h-36 shrink-0 object-cover w-full rounded-t-xl" />
                : <div className="h-36 shrink-0 rounded-t-xl" style={{ backgroundColor: cover }} />
            )}

            {/* Two-column body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

              {/* ── LEFT: main content ── */}
              <div className="flex-1 min-w-0 overflow-y-auto p-6 flex flex-col gap-5">

                {/* Title row */}
                <div className="flex items-start gap-3 pr-6">
                  <textarea
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={!task && columnId ? undefined : handleSave}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!task && columnId) handleSave() } }}
                    placeholder={!task ? 'Task title...' : undefined}
                    autoFocus={!task}
                    rows={1}
                    className="flex-1 resize-none overflow-hidden text-xl font-semibold bg-transparent border-none outline-none focus:outline-none ring-0 focus:ring-0 py-0 px-0 leading-snug placeholder:text-muted-foreground/50"
                    style={{ fieldSizing: 'content' } as React.CSSProperties}
                  />
                  {!task && columnId && (
                    <Button onClick={handleSave} disabled={!title.trim()} className="shrink-0">
                      Create
                    </Button>
                  )}
                </div>

                {/* Label chips */}
                {task && labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 -mt-2">
                    {labels.map(({ label }) => (
                      <span
                        key={label.id}
                        className="rounded-sm px-3 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <span>≡</span> Description
                  </span>
                  <MarkdownEditor value={content} onChange={setContent} onBlur={handleSave} placeholder="Add a more detailed description..." height={200} />
                </div>

                {task && <>
                {/* Checklist */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold flex items-center gap-2">☑ Checklist</span>
                    {checklist.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round((checkedCount / checklist.length) * 100)}%
                      </span>
                    )}
                  </div>
                  {checklist.length > 0 && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-300"
                        style={{ width: `${(checkedCount / checklist.length) * 100}%` }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 group rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                          className="size-4 cursor-pointer accent-green-500 shrink-0"
                        />
                        <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>
                          {item.text}
                        </span>
                        <button
                          onClick={() => deleteChecklistItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                      placeholder="Add an item..."
                      className="text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={addChecklistItem}>Add</Button>
                  </div>
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Paperclip size={14} /> Attachments
                    </span>
                    <div className="flex flex-col gap-2">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3 group hover:bg-muted/30 transition-colors">
                          <div className="size-10 shrink-0 rounded bg-muted flex items-center justify-center">
                            <Paperclip size={16} className="text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <a href={a.url} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-medium truncate block hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {a.name}
                            </a>
                            <span className="text-xs text-muted-foreground">{(a.size / 1024).toFixed(0)} KB</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => { setCover(cover === a.url ? '' : a.url); setTimeout(handleSave, 0) }}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${cover === a.url ? 'text-primary border-primary bg-primary/5' : 'text-muted-foreground border-transparent hover:border-border'}`}
                            >
                              {cover === a.url ? 'Cover ✓' : 'Cover'}
                            </button>
                            <button onClick={() => deleteAttachment(a.id)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <label className="cursor-pointer w-fit">
                  <input type="file" className="hidden" onChange={handleAttachmentUpload} />
                  <span className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors">
                    <Paperclip size={14} /> Add attachment
                  </span>
                </label>

                <Separator />

                {/* Activity / Comments */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-semibold">Activity</h4>
                  <div className="flex gap-3 items-center">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleComment() }}
                      className="flex-1"
                    />
                    <Button size="icon" variant="ghost" onClick={handleComment}>
                      <Send size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-col gap-4">
                    {(task.comments as Array<{ id: string; content: string; author: { id: string; name: string; avatarUrl?: string | null } }>)?.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <UserAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} size="sm" />
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="text-sm font-medium">{c.author.name}</span>
                          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap break-words">{c.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </>}
              </div>

              {/* ── RIGHT: sidebar ── */}
              <div className="w-56 shrink-0 border-l overflow-y-auto p-4 flex flex-col gap-4 bg-muted/10">

                {/* Close button */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</span>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Copy/Delete */}
                {task && (
                  <div className="flex flex-col gap-1.5">
                    <button onClick={handleDuplicate} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent transition-colors text-left">
                      <Copy size={13} className="shrink-0" /> Duplicate
                    </button>
                    {confirmDelete ? (
                      <div className="flex flex-col gap-1.5 rounded-md border border-destructive/30 p-2">
                        <span className="text-xs text-destructive font-medium">Delete this card?</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={handleDelete}>Delete</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(true)}
                        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors text-left text-muted-foreground"
                      >
                        <Trash2 size={13} className="shrink-0" /> Delete
                      </button>
                    )}
                  </div>
                )}

                {/* Members */}
                {task && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Members</span>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map(({ user }) => (
                        <button key={user.id} onClick={() => toggleMember(user)} title={`Remove ${user.name}`}
                          className="flex items-center gap-1.5 rounded-full border pl-1 pr-2 py-0.5 text-xs hover:bg-destructive/10 transition-colors"
                        >
                          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                          <span className="truncate max-w-24">{user.name}</span>
                          <X size={10} className="text-muted-foreground shrink-0" />
                        </button>
                      ))}
                      <div className="relative" ref={memberPickerRef}>
                        <button onClick={() => setMemberPickerOpen((v) => !v)}
                          className="flex size-6 items-center justify-center rounded-full border border-dashed hover:bg-accent transition-colors text-muted-foreground"
                        >
                          <Plus size={12} />
                        </button>
                        {memberPickerOpen && (
                          <div className="absolute left-0 top-8 z-50 min-w-48 rounded-md border bg-popover shadow-md p-1">
                            {boardMembers.filter((u) => !members.some((m) => m.user.id === u.id)).map((user) => (
                              <button key={user.id} onClick={() => { toggleMember(user); setMemberPickerOpen(false) }}
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                              >
                                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                                {user.name}
                              </button>
                            ))}
                            {boardMembers.filter((u) => !members.some((m) => m.user.id === u.id)).length === 0 && (
                              <p className="px-2 py-1.5 text-xs text-muted-foreground">All members assigned</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Labels */}
                {task && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Labels</span>
                    <div className="flex flex-wrap gap-1.5">
                      {labels.map(({ label }) => (
                        <button key={label.id} onClick={() => toggleLabel(label)}
                          className="flex items-center gap-1 rounded-sm px-2.5 py-0.5 text-xs font-semibold text-white hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name} <X size={9} />
                        </button>
                      ))}
                      <div className="relative" ref={labelPickerRef}>
                        <button onClick={() => setLabelPickerOpen((v) => !v)}
                          className="flex size-6 items-center justify-center rounded-full border border-dashed hover:bg-accent transition-colors text-muted-foreground"
                        >
                          <Plus size={12} />
                        </button>
                        {labelPickerOpen && (
                          <div className="absolute left-0 top-8 z-50 w-52 rounded-md border bg-popover shadow-md p-2 flex flex-col gap-0.5">
                            {boardLabels.map((label) => (
                              <button key={label.id} onClick={() => toggleLabel(label)}
                                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                              >
                                <span className="size-4 shrink-0 rounded-sm" style={{ backgroundColor: label.color }} />
                                <span className="flex-1 text-left">{label.name}</span>
                                {labels.some((l) => l.label.id === label.id) && <Check size={12} />}
                              </button>
                            ))}
                            <NewLabelForm boardId={task.column!.boardId} onCreated={(label) => { setBoardLabels((prev) => [...prev, label]) }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Due Date */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); setTimeout(handleSave, 0) }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {/* Cover */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cover</span>
                  <div className="flex flex-wrap gap-1.5">
                    {COVER_COLORS.map((c) => (
                      <button key={c} onClick={() => { setCover(cover === c ? '' : c); setTimeout(handleSave, 0) }}
                        className={`size-6 rounded transition-transform hover:scale-110 ${cover === c ? 'ring-2 ring-offset-1 ring-foreground scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  {cover && (
                    <button onClick={() => { setCover(''); setTimeout(handleSave, 0) }} className="text-xs text-muted-foreground hover:text-foreground text-left">
                      Remove cover
                    </button>
                  )}
                </div>

                {/* Folder */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Folder</span>
                  {fsBrowserOpen ? (
                    <div className="rounded-md border bg-popover shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/40">
                        <button onClick={() => fsBrowseParent && browseTo(fsBrowseParent)} disabled={!fsBrowseParent} className="p-0.5 rounded hover:bg-accent disabled:opacity-30">
                          <ArrowLeft size={12} />
                        </button>
                        <span className="flex-1 text-xs font-mono truncate text-muted-foreground">{fsBrowsePath}</span>
                        <button onClick={() => setFsBrowserOpen(false)} className="p-0.5 rounded hover:bg-accent">
                          <X size={12} />
                        </button>
                      </div>
                      <div className="max-h-36 overflow-y-auto">
                        {fsBrowseLoading ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
                        ) : fsBrowseEntries.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No sub-folders</p>
                        ) : fsBrowseEntries.map((name) => {
                          const full = `${fsBrowsePath}/${name}`
                          return (
                            <div key={name} className="flex items-center group hover:bg-accent">
                              <button className="flex flex-1 items-center gap-2 px-2 py-1 text-left" onClick={() => browseTo(full)}>
                                <FolderOpen size={12} className="shrink-0 text-muted-foreground" />
                                <span className="font-mono text-xs">{name}</span>
                              </button>
                              <button className="pr-2 py-1 opacity-0 group-hover:opacity-100" onClick={() => selectBrowsedFolder(full)}>
                                <ChevronRight size={12} className="text-muted-foreground" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                      <div className="border-t px-2 py-1.5 bg-muted/20">
                        <button className="text-xs text-primary hover:underline" onClick={() => selectBrowsedFolder(fsBrowsePath)}>
                          Select current
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative" ref={folderPickerRef}>
                      <div className="flex items-center gap-1">
                        <div className="relative flex-1">
                          <Folder size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                          <Input
                            value={folderPath}
                            onChange={(e) => setFolderPath(e.target.value)}
                            onFocus={() => { fetchFolderSuggestions(); setFolderPickerOpen(true) }}
                            onBlur={handleSave}
                            placeholder="src/components"
                            className="h-8 pl-6 text-xs font-mono"
                          />
                        </div>
                        <Button size="icon" variant="outline" className="size-8 shrink-0" onClick={openFsBrowser}>
                          <FolderOpen size={12} />
                        </Button>
                      </div>
                      {folderPickerOpen && (
                        <div className="absolute left-0 top-9 z-50 w-full rounded-md border bg-popover shadow-md p-1">
                          {folderSuggestions.length > 0 ? folderSuggestions.map((s) => (
                            <button key={s.path}
                              onMouseDown={(e) => { e.preventDefault(); setFolderPath(s.path); setFolderPickerOpen(false); setTimeout(handleSave, 0) }}
                              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                            >
                              <span className="font-mono text-xs">{s.path}</span>
                              <span className="text-xs text-muted-foreground shrink-0">{s.count}×</span>
                            </button>
                          )) : (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">Type or browse</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {boardBasePath && (
                    <p className="text-xs text-muted-foreground truncate">Base: <span className="font-mono">{boardBasePath}</span></p>
                  )}
                </div>

                {/* Story Points & AI Model */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Story Points</span>
                  <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} onBlur={handleSave} placeholder="0" className="h-8 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Model</span>
                  <Input value={aiModelTag} onChange={(e) => setAiModelTag(e.target.value)} onBlur={handleSave} placeholder="claude-opus-4" className="h-8 text-sm" />
                </div>

              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
