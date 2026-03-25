'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Task } from '@/types'

interface Props {
  columnId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (task: Task) => void
}

export default function CreateTaskDialog({ columnId, open, onOpenChange, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId, title }),
      })
      if (!res.ok) throw new Error('Failed')
      const task = await res.json()
      onCreated(task)
      onOpenChange(false)
      setTitle('')
      toast.success('Task created')
    } catch {
      toast.error('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required autoFocus />
          </div>
          <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Task'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
