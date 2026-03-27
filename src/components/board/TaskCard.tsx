'use client'

import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/shared/UserAvatar'
import { MessageSquare, Paperclip, CheckSquare } from 'lucide-react'
import type { Task } from '@/types'

interface Props {
  task: Task
  onClick: () => void
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date()
}

function isDueToday(dueDate: string) {
  const d = new Date(dueDate)
  const today = new Date()
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
}

export default function TaskCard({ task, onClick }: Props) {
  const checkedCount = task.checklist?.filter((i) => i.checked).length ?? 0
  const totalChecklist = task._count?.checklist ?? task.checklist?.length ?? 0
  const attachmentCount = task._count?.attachments ?? task.attachments?.length ?? 0
  const commentCount = task._count?.comments ?? (task.comments?.length ?? 0)

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card cursor-pointer shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
    >
      {/* Cover strip */}
      {task.cover && (
        task.cover.startsWith('http')
          ? <img src={task.cover} alt="Card cover" className="h-20 w-full shrink-0 object-cover" />
          : <div className="h-8 w-full shrink-0" style={{ backgroundColor: task.cover }} />
      )}

      <div className="flex flex-col gap-2 p-3">
        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.map(({ label }) => (
              <span
                key={label.id}
                className="rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm font-medium leading-snug">{task.title}</p>

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          {task.points != null && (
            <Badge variant="outline" className="text-xs">{task.points} pts</Badge>
          )}
          {task.aiModelTag && (
            <Badge variant="secondary" className="text-xs">{task.aiModelTag}</Badge>
          )}
          {task.dueDate && (
            <Badge
              variant="outline"
              className={`text-xs ${
                isOverdue(task.dueDate)
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : isDueToday(task.dueDate)
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-600'
                  : ''
              }`}
            >
              {new Date(task.dueDate).toLocaleDateString()}
            </Badge>
          )}
        </div>

        {/* Footer */}
        {(totalChecklist > 0 || attachmentCount > 0 || commentCount > 0 || (task.members && task.members.length > 0)) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {totalChecklist > 0 && (
              <span className="flex items-center gap-1">
                <CheckSquare size={12} />
                {checkedCount}/{totalChecklist}
              </span>
            )}
            {attachmentCount > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip size={12} />
                {attachmentCount}
              </span>
            )}
            {commentCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={12} />
                {commentCount}
              </span>
            )}
            {task.members && task.members.length > 0 && (
              <div className="ml-auto flex items-center -space-x-1">
                {task.members.slice(0, 3).map(({ user }) => (
                  <UserAvatar key={user.id} name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                ))}
                {task.members.length > 3 && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    +{task.members.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
