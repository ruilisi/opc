'use client'

import { useState, useRef, useEffect } from 'react'
import { Droppable, Draggable, type DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import TaskCard from './TaskCard'
import ColumnHeader from './ColumnHeader'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Task } from '@/types'

interface Column {
  id: string
  name: string
  order: number
  boardId: string
  tasks: Task[]
}

interface Props {
  column: Column
  onTaskClick: (taskId: string) => void
  onTaskCreated: (task: Task) => void
  onColumnDeleted: (columnId: string) => void
  onColumnRenamed: (columnId: string, name: string) => void
  dragHandleProps?: DraggableProvidedDragHandleProps | null
}

export default function KanbanColumn({ column, onTaskClick, onTaskCreated, onColumnDeleted, onColumnRenamed, dragHandleProps }: Props) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (adding) textareaRef.current?.focus()
  }, [adding])

  function openAdd() {
    setTitle('')
    setAdding(true)
  }

  function closeAdd() {
    setAdding(false)
    setTitle('')
  }

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: column.id, title: title.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      const task = await res.json()
      onTaskCreated(task)
      setTitle('')
      textareaRef.current?.focus()
    } catch {
      toast.error('Failed to create card')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAdd()
    }
    if (e.key === 'Escape') closeAdd()
  }

  return (
    <div className="w-64 shrink-0 flex flex-col rounded-lg bg-muted/50 p-3 max-h-full">
      <div {...(dragHandleProps ?? {})}>
        <ColumnHeader
          column={column}
          taskCount={column.tasks.length}
          onAddTask={openAdd}
          onDeleted={onColumnDeleted}
          onRenamed={onColumnRenamed}
        />
      </div>
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 flex-1 min-h-[40px] overflow-y-auto rounded-md transition-colors ${
              snapshot.isDraggingOver ? 'bg-muted' : ''
            }`}
          >
            {column.tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      ...provided.draggableProps.style,
                      opacity: snapshot.isDragging ? 0.8 : 1,
                    }}
                  >
                    <TaskCard task={task} onClick={() => onTaskClick(task.id)} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Inline add card form */}
      {adding ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter a title for this card…"
            rows={3}
            className="w-full resize-none rounded-lg border bg-card p-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!title.trim() || saving}>
              Add card
            </Button>
            <button onClick={closeAdd} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openAdd}
          className="mt-2 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Plus size={16} />
          Add a card
        </button>
      )}
    </div>
  )
}
