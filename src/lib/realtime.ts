import { EventEmitter } from 'events'

const emitter = new EventEmitter()
emitter.setMaxListeners(200)

export interface BoardEvent {
  type: 'task.created' | 'task.updated' | 'task.deleted' | 'task.moved' | 'comment.added'
  payload: object
}

export function emitBoardEvent(boardId: string, event: BoardEvent) {
  emitter.emit(`board:${boardId}`, event)
}

export function subscribeBoardEvents(boardId: string, handler: (event: BoardEvent) => void): () => void {
  emitter.on(`board:${boardId}`, handler)
  return () => emitter.off(`board:${boardId}`, handler)
}
