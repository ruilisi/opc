'use client'

import { useEffect, useRef } from 'react'
import type { Task } from '@/types'

export interface CommentPayload {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string; avatarUrl?: string | null }
}

export interface BoardHandlers {
  onTaskMoved?: (taskId: string, columnId: string, order: number) => void
  onTaskUpdated?: (task: Task) => void
  onCommentAdded?: (taskId: string, comment: CommentPayload) => void
  onTaskCreated?: (task: Task) => void
  onTaskDeleted?: (taskId: string) => void
}

export function useBoardSubscription(boardId: string, handlers: BoardHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!boardId) return
    const es = new EventSource(`/api/boards/${boardId}/events`)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string)
        const h = handlersRef.current
        switch (event.type) {
          case 'task.moved':
            h.onTaskMoved?.(event.payload.taskId, event.payload.columnId, event.payload.order)
            break
          case 'task.updated':
            h.onTaskUpdated?.(event.payload)
            break
          case 'comment.added':
            h.onCommentAdded?.(event.payload.taskId, event.payload.comment)
            break
          case 'task.created':
            h.onTaskCreated?.(event.payload)
            break
          case 'task.deleted':
            h.onTaskDeleted?.(event.payload.taskId)
            break
        }
      } catch {
        // ignore parse errors
      }
    }

    return () => es.close()
  }, [boardId])
}
