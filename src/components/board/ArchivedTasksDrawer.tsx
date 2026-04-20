'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw, Trash2 } from 'lucide-react'
import type { Task } from '@/types'

interface Props {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored: (task: Task) => void
  onDeleted: (taskId: string) => void
}

export default function ArchivedTasksDrawer({ boardId, open, onOpenChange, onRestored, onDeleted }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  const fetchArchived = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/archived-tasks`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTasks(data)
    } catch {
      toast.error('Failed to load archived tasks')
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    if (open) fetchArchived()
  }, [open, fetchArchived])

  async function handleRestore(task: Task) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: false }),
      })
      if (!res.ok) throw new Error('Failed')
      setTasks((ts) => ts.filter((t) => t.id !== task.id))
      onRestored(task)
      toast.success('Card restored')
    } catch {
      toast.error('Failed to restore card')
    }
  }

  async function handleDelete(taskId: string) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setTasks((ts) => ts.filter((t) => t.id !== taskId))
      onDeleted(taskId)
      toast.success('Card deleted')
    } catch {
      toast.error('Failed to delete card')
    }
  }

  // Group by column
  const grouped = tasks.reduce<Record<string, { columnName: string; tasks: Task[] }>>((acc, task) => {
    const colId = task.column?.id ?? 'unknown'
    const colName = task.column?.name ?? 'Unknown column'
    if (!acc[colId]) acc[colId] = { columnName: colName, tasks: [] }
    acc[colId].tasks.push(task)
    return acc
  }, {})

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-sm">Archived Items</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
          {!loading && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No archived cards.</p>
          )}
          {!loading && Object.values(grouped).map(({ columnName, tasks: colTasks }) => (
            <div key={columnName} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{columnName}</p>
              {colTasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.points != null && (
                        <span className="text-xs text-primary font-medium">{task.points} pts</span>
                      )}
                      {task.labels?.map(({ label }) => (
                        <span
                          key={label.id}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRestore(task)}
                      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Restore"
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {tasks.length > 0 && (
          <div className="shrink-0 border-t px-4 py-3">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={async () => {
                if (!confirm('Permanently delete all archived cards?')) return
                try {
                  await Promise.all(tasks.map((t) => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' })))
                  tasks.forEach((t) => onDeleted(t.id))
                  setTasks([])
                  toast.success('All archived cards deleted')
                } catch {
                  toast.error('Failed to delete all')
                }
              }}
            >
              Delete All Archived
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
