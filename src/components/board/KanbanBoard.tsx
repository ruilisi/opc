'use client'

import React, { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import KanbanColumn from './KanbanColumn'
import TaskDetailDialog from './TaskDetailDialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { computeOrder } from '@/lib/utils'
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
  boardId: string
  initialColumns: Column[]
}

export default function KanbanBoard({ boardId, initialColumns }: Props) {
  const [columns, setColumns] = useState(initialColumns)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Column reordering
    if (type === 'COLUMN') {
      const reordered = [...columns]
      const [moved] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, moved)
      const newOrder = destination.index * 1000
      setColumns(reordered.map((c, i) => ({ ...c, order: i * 1000 })))
      try {
        await fetch(`/api/boards/${boardId}/columns/${draggableId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newOrder }),
        })
      } catch {
        toast.error('Failed to save column position')
      }
      return
    }

    // Card reordering
    const srcCol = columns.find((c) => c.id === source.droppableId)
    const dstCol = columns.find((c) => c.id === destination.droppableId)
    if (!srcCol || !dstCol) return

    const srcTasks = [...srcCol.tasks]
    const [movedTask] = srcTasks.splice(source.index, 1)

    let newOrder: number
    if (source.droppableId === destination.droppableId) {
      const dstTasks = srcTasks
      dstTasks.splice(destination.index, 0, movedTask)
      const above = dstTasks[destination.index - 1]?.order ?? null
      const below = dstTasks[destination.index + 1]?.order ?? null
      newOrder = computeOrder(above, below)

      setColumns((cols) =>
        cols.map((c) =>
          c.id === srcCol.id ? { ...c, tasks: dstTasks.map((t, i) => i === destination.index ? { ...t, order: newOrder } : t) } : c
        )
      )
    } else {
      const dstTasks = [...dstCol.tasks]
      dstTasks.splice(destination.index, 0, movedTask)
      const above = dstTasks[destination.index - 1]?.order ?? null
      const below = dstTasks[destination.index + 1]?.order ?? null
      newOrder = computeOrder(above, below)

      setColumns((cols) =>
        cols.map((c) => {
          if (c.id === srcCol.id) return { ...c, tasks: srcTasks }
          if (c.id === dstCol.id) return { ...c, tasks: dstTasks.map((t, i) => i === destination.index ? { ...t, order: newOrder } : t) }
          return c
        })
      )
    }

    try {
      await fetch(`/api/tasks/${draggableId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId: dstCol.id, order: newOrder }),
      })
    } catch {
      toast.error('Failed to save position')
    }
  }, [columns, boardId])

  async function addColumn() {
    const name = prompt('Column name:')
    if (!name) return
    try {
      const res = await fetch(`/api/boards/${boardId}/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed')
      const col = await res.json()
      setColumns((c) => [...c, { ...col, tasks: [] }])
    } catch {
      toast.error('Failed to add column')
    }
  }

  function handleTaskCreated(columnId: string, task: Task) {
    setColumns((cols) =>
      cols.map((c) => c.id === columnId ? { ...c, tasks: [...c.tasks, task] } : c)
    )
  }

  function handleTaskUpdated(task: Task) {
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t)),
      }))
    )
  }

  function handleTaskDeleted(taskId: string) {
    setColumns((cols) =>
      cols.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }))
    )
  }

  function handleColumnDeleted(columnId: string) {
    setColumns((cols) => cols.filter((c) => c.id !== columnId))
  }

  function handleColumnRenamed(columnId: string, name: string) {
    setColumns((cols) => cols.map((c) => c.id === columnId ? { ...c, name } : c))
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex gap-4 overflow-x-auto p-4 h-full"
            >
              {columns.map((col, index) => (
                <Draggable key={col.id} draggableId={col.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.85 : 1,
                      }}
                    >
                      <KanbanColumn
                        column={col}
                        onTaskClick={(taskId) => { setSelectedTaskId(taskId); setTaskDialogOpen(true) }}
                        onTaskCreated={(task) => handleTaskCreated(col.id, task)}
                        onColumnDeleted={handleColumnDeleted}
                        onColumnRenamed={handleColumnRenamed}
                        dragHandleProps={provided.dragHandleProps as React.HTMLAttributes<HTMLElement>}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              <div className="shrink-0 w-64">
                <Button variant="outline" className="w-full" onClick={addColumn}>
                  <Plus size={16} />
                  Add Column
                </Button>
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <TaskDetailDialog
        taskId={selectedTaskId}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    </>
  )
}
