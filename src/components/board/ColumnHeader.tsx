'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Props {
  column: { id: string; name: string; boardId: string }
  taskCount: number
  onAddTask: () => void
  onDeleted: (columnId: string) => void
  onRenamed: (columnId: string, name: string) => void
}

export default function ColumnHeader({ column, taskCount, onAddTask, onDeleted, onRenamed }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)

  async function handleRename() {
    if (name === column.name || !name.trim()) { setEditing(false); return }
    try {
      const res = await fetch(`/api/boards/${column.boardId}/columns/${column.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed')
      onRenamed(column.id, name)
      setEditing(false)
    } catch {
      toast.error('Failed to rename column')
      setName(column.name)
      setEditing(false)
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/boards/${column.boardId}/columns/${column.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      onDeleted(column.id)
    } catch {
      toast.error('Failed to delete column')
    }
  }

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false) }}
            className="h-7 text-sm font-semibold"
            autoFocus
          />
        ) : (
          <h3 className="text-sm font-semibold truncate cursor-pointer" onDoubleClick={() => setEditing(true)}>
            {column.name}
          </h3>
        )}
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{taskCount}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="size-7" onClick={onAddTask}>
          <Plus size={14} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent">
            <MoreHorizontal size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={handleDelete}>Delete Column</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
