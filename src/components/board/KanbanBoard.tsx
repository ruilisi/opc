'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import KanbanColumn from './KanbanColumn'
import TaskDetailDialog from './TaskDetailDialog'
import { Button } from '@/components/ui/button'
import { Plus, Filter } from 'lucide-react'
import { computeOrder } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task, BoardFilters } from '@/types'

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
  const [filters, setFilters] = useState<BoardFilters>({ labelIds: [], userIds: [], due: null })
  const [filterOpen, setFilterOpen] = useState(false)
  const filterPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    for (const col of columns) {
      for (const task of col.tasks) {
        for (const { label } of task.labels ?? []) {
          map.set(label.id, label)
        }
      }
    }
    return [...map.values()]
  }, [columns])

  const allMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatarUrl?: string | null }>()
    for (const col of columns) {
      for (const task of col.tasks) {
        for (const { user } of task.members ?? []) {
          map.set(user.id, user)
        }
      }
    }
    return [...map.values()]
  }, [columns])

  const isFiltered = filters.labelIds.length > 0 || filters.userIds.length > 0 || filters.due !== null

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    // Column reordering
    if (type === 'COLUMN') {
      const originalColumns = columns
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
        setColumns(originalColumns)
        toast.error('Failed to save column position')
      }
      return
    }

    // Card reordering
    const srcCol = columns.find((c) => c.id === source.droppableId)
    const dstCol = columns.find((c) => c.id === destination.droppableId)
    if (!srcCol || !dstCol) return

    const srcTasks = [...srcCol.tasks]
    const srcIdx = srcTasks.findIndex((t) => t.id === draggableId)
    if (srcIdx === -1) return
    const [movedTask] = srcTasks.splice(srcIdx, 1)

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
      {/* Filter toolbar */}
      {(allLabels.length > 0 || allMembers.length > 0) && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-0 shrink-0">
          <div className="relative">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${isFiltered ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Filter size={12} />
              Filter
              {isFiltered && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-medium">
                  {filters.labelIds.length + filters.userIds.length + (filters.due ? 1 : 0)}
                </span>
              )}
            </button>
            {filterOpen && (
              <div ref={filterPanelRef} className="absolute left-0 top-8 z-50 w-64 rounded-md border bg-popover shadow-md p-3 flex flex-col gap-3">
                {allLabels.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">Labels</p>
                    <div className="flex flex-wrap gap-1">
                      {allLabels.map((label) => {
                        const active = filters.labelIds.includes(label.id)
                        return (
                          <button
                            key={label.id}
                            onClick={() => setFilters((f) => ({
                              ...f,
                              labelIds: active ? f.labelIds.filter((id) => id !== label.id) : [...f.labelIds, label.id]
                            }))}
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-white transition-opacity ${active ? 'ring-2 ring-offset-1 ring-foreground' : 'opacity-70 hover:opacity-100'}`}
                            style={{ backgroundColor: label.color }}
                          >
                            {label.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {allMembers.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">Members</p>
                    <div className="flex flex-wrap gap-1">
                      {allMembers.map((user) => {
                        const active = filters.userIds.includes(user.id)
                        return (
                          <button
                            key={user.id}
                            onClick={() => setFilters((f) => ({
                              ...f,
                              userIds: active ? f.userIds.filter((id) => id !== user.id) : [...f.userIds, user.id]
                            }))}
                            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors ${active ? 'border-primary bg-primary/10' : 'hover:bg-accent'}`}
                          >
                            {user.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Due Date</p>
                  <div className="flex flex-wrap gap-1">
                    {(['overdue', 'today', 'upcoming', 'none'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFilters((f) => ({ ...f, due: f.due === opt ? null : opt }))}
                        className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${filters.due === opt ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                      >
                        {opt === 'none' ? 'No due date' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {isFiltered && (
                  <button
                    onClick={() => setFilters({ labelIds: [], userIds: [], due: null })}
                    className="text-xs text-muted-foreground hover:text-foreground text-left"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
                        filters={filters}
                        isFiltered={isFiltered}
                        onTaskClick={(taskId) => { setSelectedTaskId(taskId); setTaskDialogOpen(true) }}
                        onTaskCreated={(task) => handleTaskCreated(col.id, task)}
                        onColumnDeleted={handleColumnDeleted}
                        onColumnRenamed={handleColumnRenamed}
                        dragHandleProps={provided.dragHandleProps}
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
