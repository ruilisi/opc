'use client'

import { useEffect, useRef } from 'react'
import type { OrgFile, OrgFolder, OrgFileTag } from '@/types'

export interface OrgFileHandlers {
  onFileUploaded?: (file: OrgFile) => void
  onFileRenamed?: (fileId: string, name: string) => void
  onFileMoved?: (fileId: string, folderId: string | null) => void
  onFileDeleted?: (fileId: string) => void
  onFileTagAdded?: (fileId: string, tag: OrgFileTag) => void
  onFileTagRemoved?: (fileId: string, tagId: string) => void
  onFolderCreated?: (folder: OrgFolder) => void
  onFolderRenamed?: (folderId: string, name: string) => void
  onFolderDeleted?: (folderId: string) => void
  onTagCreated?: (tag: OrgFileTag) => void
  onTagUpdated?: (tag: OrgFileTag) => void
  onTagDeleted?: (tagId: string) => void
}

export function useOrgFileSubscription(orgId: string, handlers: OrgFileHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!orgId) return
    const es = new EventSource(`/api/orgs/${orgId}/file-events`)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string)
        const h = handlersRef.current
        switch (event.type) {
          case 'file.uploaded':    h.onFileUploaded?.(event.payload); break
          case 'file.renamed':     h.onFileRenamed?.(event.payload.fileId, event.payload.name); break
          case 'file.moved':       h.onFileMoved?.(event.payload.fileId, event.payload.folderId); break
          case 'file.deleted':     h.onFileDeleted?.(event.payload.fileId); break
          case 'file.tag_added':   h.onFileTagAdded?.(event.payload.fileId, event.payload.tag); break
          case 'file.tag_removed': h.onFileTagRemoved?.(event.payload.fileId, event.payload.tagId); break
          case 'folder.created':   h.onFolderCreated?.(event.payload); break
          case 'folder.renamed':   h.onFolderRenamed?.(event.payload.folderId, event.payload.name); break
          case 'folder.deleted':   h.onFolderDeleted?.(event.payload.folderId); break
          case 'tag.created':      h.onTagCreated?.(event.payload); break
          case 'tag.updated':      h.onTagUpdated?.(event.payload); break
          case 'tag.deleted':      h.onTagDeleted?.(event.payload.tagId); break
        }
      } catch { /* ignore parse errors */ }
    }

    return () => es.close()
  }, [orgId])
}
