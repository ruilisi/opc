'use client'

import { Droppable, Draggable } from '@hello-pangea/dnd'
import TaskCard from './TaskCard'
import ColumnHeader from './ColumnHeader'
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
  onAddTask: () => void
  onColumnDeleted: (columnId: string) => void
  onColumnRenamed: (columnId: string, name: string) => void
}

export default function KanbanColumn({ column, onTaskClick, onAddTask, onColumnDeleted, onColumnRenamed }: Props) {
  return (
    <div className="w-64 shrink-0 flex flex-col rounded-lg bg-muted/50 p-3">
      <ColumnHeader
        column={column}
        taskCount={column.tasks.length}
        onAddTask={onAddTask}
        onDeleted={onColumnDeleted}
        onRenamed={onColumnRenamed}
      />
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 flex-1 min-h-[100px] rounded-md transition-colors ${
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
    </div>
  )
}
