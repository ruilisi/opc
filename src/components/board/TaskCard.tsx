'use client'

import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/shared/UserAvatar'
import { MessageSquare, Paperclip, CheckSquare } from 'lucide-react'
import type { Task } from '@/types'
import { useT } from '@/lib/i18n'

interface Props {
  task: Task
  onClick: () => void
}

function calendarDiff(dueDate: string | Date): number {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let due: Date
  if (dueDate instanceof Date) {
    due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
  } else {
    const [y, m, d] = dueDate.slice(0, 10).split('-').map(Number)
    due = new Date(y, m - 1, d)
  }
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function TaskCard({ task, onClick }: Props) {
  const { dict } = useT()
  const checkedCount = task.checklist?.filter((i) => i.checked).length ?? 0
  const totalChecklist = task._count?.checklist ?? task.checklist?.length ?? 0
  const attachmentCount = task._count?.attachments ?? task.attachments?.length ?? 0
  const commentCount = task._count?.comments ?? (task.comments?.length ?? 0)

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border bg-card cursor-pointer shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden ${
        task.priority === 4 ? 'border-l-[3px] border-l-red-500' :
        task.priority === 3 ? 'border-l-[3px] border-l-orange-400' :
        task.priority === 2 ? 'border-l-[3px] border-l-yellow-400' :
        task.priority === 1 ? 'border-l-[3px] border-l-blue-400' : ''
      }`}
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
          {task.priority != null && task.priority > 0 && (
            <Badge
              variant="outline"
              className={`text-xs ${
                task.priority === 4 ? 'border-red-400 bg-red-50 text-red-600' :
                task.priority === 3 ? 'border-orange-400 bg-orange-50 text-orange-600' :
                task.priority === 2 ? 'border-yellow-400 bg-yellow-50 text-yellow-600' :
                'border-blue-300 bg-blue-50 text-blue-600'
              }`}
            >
              {task.priority === 4 ? '🔴 Urgent' : task.priority === 3 ? '🟠 High' : task.priority === 2 ? '🟡 Medium' : '🔵 Low'}
            </Badge>
          )}
          {task.points != null && (
            <Badge variant="outline" className="text-xs">{task.points} pts</Badge>
          )}
          {task.aiModelTag && (
            <Badge variant="secondary" className="text-xs">{task.aiModelTag}</Badge>
          )}
          {task.dueDate && (() => {
            const diff = calendarDiff(task.dueDate)
            const label = diff < 0
              ? (dict.due_label_overdue as string)
              : diff === 0 ? (dict.due_label_today as string)
              : diff === 1 ? (dict.due_label_tomorrow as string)
              : diff === 2 ? (dict.due_label_2days as string)
              : diff <= 30 ? dict.due_label_n_days(diff)
              : new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            return (
              <Badge
                variant="outline"
                className={`text-xs ${
                  diff < 0 ? 'border-red-500 bg-red-50 text-red-600'
                  : diff === 0 ? 'border-yellow-500 bg-yellow-50 text-yellow-600'
                  : ''
                }`}
              >
                {label}
              </Badge>
            )
          })()}
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
