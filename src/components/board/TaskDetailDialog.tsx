'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import MarkdownEditor from '@/components/editor/MarkdownEditor'
import UserAvatar from '@/components/shared/UserAvatar'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

interface Task {
  id: string
  title: string
  content?: string | null
  points?: number | null
  aiModelTag?: string | null
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null
  comments?: Array<{
    id: string
    content: string
    author: { id: string; name: string; avatarUrl?: string | null }
    createdAt: string
  }>
}

interface Props {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (task: Task) => void
}

export default function TaskDetailDialog({ taskId, open, onOpenChange, onUpdated }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [points, setPoints] = useState('')
  const [aiModelTag, setAiModelTag] = useState('')
  const [commentText, setCommentText] = useState('')

  useEffect(() => {
    if (!taskId || !open) return
    setLoading(true)
    fetch(`/api/tasks/${taskId}`)
      .then((r) => r.json())
      .then((t) => {
        setTask(t)
        setTitle(t.title)
        setContent(t.content ?? '')
        setPoints(t.points?.toString() ?? '')
        setAiModelTag(t.aiModelTag ?? '')
      })
      .finally(() => setLoading(false))
  }, [taskId, open])

  async function handleSave() {
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
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setTask((t) => t ? { ...t, ...updated } : t)
      onUpdated(updated)
    } catch {
      toast.error('Failed to save task')
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-4 p-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : task ? (
          <>
            <DialogHeader>
              <DialogTitle>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg font-bold border-none shadow-none px-0 focus-visible:ring-0"
                />
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-4">
              {/* Editor */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <MarkdownEditor value={content} onChange={setContent} onBlur={handleSave} placeholder="Add description..." height={600} />
                <Separator />
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold">Comments</h4>
                  {task.comments?.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <UserAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} size="sm" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium">{c.author.name}</span>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Add a comment..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleComment() }}
                    />
                    <Button size="icon" variant="ghost" onClick={handleComment}>
                      <Send size={16} />
                    </Button>
                  </div>
                </div>
              </div>
              {/* Sidebar */}
              <div className="w-48 shrink-0 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Story Points</Label>
                  <Input
                    type="number"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">AI Model</Label>
                  <Input
                    value={aiModelTag}
                    onChange={(e) => setAiModelTag(e.target.value)}
                    placeholder="claude-opus-4"
                    className="h-8 text-sm"
                  />
                </div>
                {task.assignee && (
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Assignee</Label>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="sm" />
                      <span className="text-sm">{task.assignee.name}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
