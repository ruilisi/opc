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

export interface OrgFileEvent {
  type:
    | 'file.uploaded'
    | 'file.renamed'
    | 'file.moved'
    | 'file.deleted'
    | 'file.tag_added'
    | 'file.tag_removed'
    | 'folder.created'
    | 'folder.renamed'
    | 'folder.deleted'
    | 'tag.created'
    | 'tag.updated'
    | 'tag.deleted'
  payload: object
}

export function emitOrgFileEvent(orgId: string, event: OrgFileEvent) {
  emitter.emit(`org-files:${orgId}`, event)
}

export function subscribeOrgFileEvents(
  orgId: string,
  handler: (event: OrgFileEvent) => void
): () => void {
  emitter.on(`org-files:${orgId}`, handler)
  return () => emitter.off(`org-files:${orgId}`, handler)
}
