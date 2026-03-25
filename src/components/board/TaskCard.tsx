'use client'

import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/shared/UserAvatar'
import { MessageSquare } from 'lucide-react'

interface Task {
  id: string
  title: string
  points?: number | null
  aiModelTag?: string | null
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null
  comments?: unknown[]
}

interface Props {
  task: Task
  onClick: () => void
}

export default function TaskCard({ task, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card p-3 cursor-pointer shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2"
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {task.points != null && (
          <Badge variant="outline" className="text-xs">{task.points} pts</Badge>
        )}
        {task.aiModelTag && (
          <Badge variant="secondary" className="text-xs">{task.aiModelTag}</Badge>
        )}
        {task.comments && task.comments.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare size={12} />
            {task.comments.length}
          </span>
        )}
      </div>
      {task.assignee && (
        <div className="flex items-center gap-2">
          <UserAvatar name={task.assignee.name} avatarUrl={task.assignee.avatarUrl} size="sm" />
          <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
        </div>
      )}
    </div>
  )
}
