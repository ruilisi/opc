'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Upload, Search, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PromptDialog } from '@/components/ui/prompt-dialog'
import FolderTree from '@/components/files/FolderTree'
import FileIcon, { formatBytes } from '@/components/files/FileIcon'
import FileContextMenu from '@/components/files/FileContextMenu'
import FilePreviewModal from '@/components/files/FilePreviewModal'
import TagFilterBar from '@/components/files/TagFilterBar'
import { useOrgFileSubscription } from '@/lib/hooks/useOrgFileSubscription'
import { useT } from '@/lib/i18n'
import type { OrgFile, OrgFolder, OrgFileTag } from '@/types'

const FILE_SIZE_LIMIT = 100 * 1024 * 1024

export default function OrgFilesPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { t } = useT()

  const [files, setFiles] = useState<OrgFile[]>([])
  const [folders, setFolders] = useState<OrgFolder[]>([])
  const [tags, setTags] = useState<OrgFileTag[]>([])
  const [myRole, setMyRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [sort, setSort] = useState<'name' | 'size' | 'createdAt'>('createdAt')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const [previewFile, setPreviewFile] = useState<OrgFile | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ file: OrgFile; x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState<{ file: OrgFile; name: string } | null>(null)
  const [moving, setMoving] = useState<OrgFile | null>(null)
  const [tagging, setTagging] = useState<OrgFile | null>(null)
  // Modal state for confirm/prompt dialogs
  const [deleteFileTarget, setDeleteFileTarget] = useState<OrgFile | null>(null)
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<string | null | undefined>(undefined)
  const [renamingFolder, setRenamingFolder] = useState<OrgFolder | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<OrgFolder | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const canManage = myRole === 'admin' || myRole === 'owner'

  function canEditFile(_file: OrgFile) {
    if (myRole === 'viewer') return false
    return true // server enforces the actual per-file check
  }

  // Fetch data
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) {
        params.set('search', search)
      } else if (selectedFolderId) {
        params.set('folderId', selectedFolderId)
      }
      selectedTagIds.forEach((id) => params.append('tagId', id))
      params.set('sort', sort)
      params.set('order', order)

      const [filesRes, foldersRes, tagsRes, orgRes] = await Promise.all([
        fetch(`/api/orgs/${orgId}/files?${params}`),
        fetch(`/api/orgs/${orgId}/folders`),
        fetch(`/api/orgs/${orgId}/file-tags`),
        fetch(`/api/orgs/${orgId}`),
      ])
      const [filesData, foldersData, tagsData, orgData] = await Promise.all([
        filesRes.json(), foldersRes.json(), tagsRes.json(), orgRes.json(),
      ])
      setFiles(filesData.files ?? [])
      setFolders(Array.isArray(foldersData) ? foldersData : [])
      setTags(Array.isArray(tagsData) ? tagsData : [])
      setMyRole(orgData.myRole ?? orgData.role ?? 'member')
    } finally {
      setLoading(false)
    }
  }, [orgId, selectedFolderId, search, selectedTagIds, sort, order])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Debounce search input → search state
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Upload handler
  async function handleUpload(fileToUpload: File) {
    if (fileToUpload.size > FILE_SIZE_LIMIT) { toast.error(t('files_too_large')); return }
    const formData = new FormData()
    formData.append('file', fileToUpload)
    if (selectedFolderId) formData.append('folderId', selectedFolderId)
    try {
      const res = await fetch(`/api/orgs/${orgId}/files`, { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? t('files_upload_error'))
      }
    } catch {
      toast.error(t('files_upload_error'))
    }
  }

  // Realtime
  useOrgFileSubscription(orgId, {
    onFileUploaded: (file) => setFiles((fs) => fs.some((f) => f.id === file.id) ? fs : [file, ...fs]),
    onFileRenamed: (fileId, name) => setFiles((fs) => fs.map((f) => f.id === fileId ? { ...f, name } : f)),
    onFileMoved: (fileId, folderId) => {
      setFiles((fs) => {
        if (selectedFolderId !== null && folderId !== selectedFolderId) {
          return fs.filter((f) => f.id !== fileId)
        }
        return fs.map((f) => f.id === fileId ? { ...f, folderId } : f)
      })
    },
    onFileDeleted: (fileId) => setFiles((fs) => fs.filter((f) => f.id !== fileId)),
    onFileTagAdded: (fileId, tag) => setFiles((fs) => fs.map((f) =>
      f.id === fileId ? { ...f, tags: f.tags.some((t) => t.tag.id === tag.id) ? f.tags : [...f.tags, { tag }] } : f
    )),
    onFileTagRemoved: (fileId, tagId) => setFiles((fs) => fs.map((f) =>
      f.id === fileId ? { ...f, tags: f.tags.filter((t) => t.tag.id !== tagId) } : f
    )),
    onFolderCreated: (folder) => setFolders((fs) => fs.some((f) => f.id === folder.id) ? fs : [...fs, folder]),
    onFolderRenamed: (folderId, name) => setFolders((fs) => fs.map((f) => f.id === folderId ? { ...f, name } : f)),
    onFolderDeleted: (folderId) => {
      setFolders((fs) => fs.filter((f) => f.id !== folderId))
      if (selectedFolderId === folderId) setSelectedFolderId(null)
    },
    onTagCreated: (tag) => setTags((ts) => ts.some((t) => t.id === tag.id) ? ts : [...ts, tag]),
    onTagUpdated: (tag) => setTags((ts) => ts.map((t) => t.id === tag.id ? tag : t)),
    onTagDeleted: (tagId) => {
      setTags((ts) => ts.filter((t) => t.id !== tagId))
      setSelectedTagIds((ids) => ids.filter((id) => id !== tagId))
    },
  })

  // Rename submit
  async function submitRename() {
    if (!renaming) return
    if (!renaming.name.trim()) return
    const res = await fetch(`/api/orgs/${orgId}/files/${renaming.file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renaming.name }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
      return
    }
    setRenaming(null)
  }

  // Delete file (opens confirm modal)
  function deleteFile(file: OrgFile) { setDeleteFileTarget(file) }
  async function confirmDeleteFile() {
    if (!deleteFileTarget) return
    const res = await fetch(`/api/orgs/${orgId}/files/${deleteFileTarget.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
    }
    setDeleteFileTarget(null)
  }

  // Create folder (opens prompt modal)
  function createFolder(parentId: string | null) { setCreatingFolderParentId(parentId) }
  async function confirmCreateFolder(name: string) {
    const res = await fetch(`/api/orgs/${orgId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: creatingFolderParentId ?? null }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
      return
    }
    toast.success(t('folders_created'))
  }

  // Rename folder (opens prompt modal)
  function renameFolder(folder: OrgFolder) { setRenamingFolder(folder) }
  async function confirmRenameFolder(name: string) {
    if (!renamingFolder || name === renamingFolder.name) return
    const res = await fetch(`/api/orgs/${orgId}/folders/${renamingFolder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
      return
    }
    toast.success(t('folders_renamed'))
  }

  // Delete folder (opens confirm modal)
  function deleteFolder(folder: OrgFolder) { setDeleteFolderTarget(folder) }
  async function confirmDeleteFolder() {
    if (!deleteFolderTarget) return
    const res = await fetch(`/api/orgs/${orgId}/folders/${deleteFolderTarget.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
      return
    }
    toast.success(t('folders_deleted'))
    setDeleteFolderTarget(null)
  }

  // Move file
  async function moveFile(file: OrgFile, targetFolderId: string | null) {
    const res = await fetch(`/api/orgs/${orgId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: targetFolderId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
      setMoving(null)
      return
    }
    toast.success(t('files_moved'))
    setMoving(null)
  }

  // Tag toggle on file
  async function toggleTag(file: OrgFile, tagId: string) {
    const has = file.tags.some((t) => t.tag.id === tagId)
    const method = has ? 'DELETE' : 'POST'
    const res = await fetch(`/api/orgs/${orgId}/files/${file.id}/tags/${tagId}`, { method })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? t('generic_error'))
    }
  }

  function cycleSortBy(col: 'name' | 'size' | 'createdAt') {
    if (sort === col) setOrder((o) => o === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder('asc') }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <h1 className="text-lg font-semibold shrink-0">{t('files_title')}</h1>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('files_search_ph')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <TagFilterBar tags={tags} selected={selectedTagIds} onToggle={(id) => setSelectedTagIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])} />
        {myRole !== 'viewer' && (
          <>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} className="mr-1.5" />
              {t('files_upload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => Array.from(e.target.files ?? []).forEach(handleUpload)}
            />
          </>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Folder tree panel */}
        <div className="w-52 shrink-0 border-r overflow-y-auto p-2">
          <FolderTree
            folders={folders}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            canManage={canManage}
          />
        </div>

        {/* File list */}
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_120px_110px] gap-2 px-4 py-2 text-xs text-muted-foreground border-b sticky top-0 bg-background">
            <button className="flex items-center gap-1 text-left hover:text-foreground" onClick={() => cycleSortBy('name')}>
              {t('files_col_name')} <ArrowUpDown size={10} />
            </button>
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => cycleSortBy('size')}>
              {t('files_col_size')} <ArrowUpDown size={10} />
            </button>
            <span>{t('files_col_uploader')}</span>
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => cycleSortBy('createdAt')}>
              {t('files_col_date')} <ArrowUpDown size={10} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : files.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('files_empty')}</div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="group grid grid-cols-[1fr_80px_120px_110px] gap-2 px-4 py-2.5 text-sm hover:bg-muted cursor-pointer border-b border-border/50"
                onClick={() => { setPreviewFile(file); setPreviewOpen(true) }}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ file, x: e.clientX, y: e.clientY }) }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileIcon mimeType={file.mimeType} size={18} className="shrink-0" />
                  {renaming?.file.id === file.id ? (
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      onBlur={submitRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null) }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded border bg-background px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <span className="truncate">{file.name}</span>
                  )}
                  {file.tags.length > 0 && (
                    <div className="hidden group-hover:flex items-center gap-1">
                      {file.tags.slice(0, 3).map((t) => (
                        <span key={t.tag.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: t.tag.color }}>
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="size-[18px] shrink-0 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium">
                    {file.uploader.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-muted-foreground">{file.uploader.name}</span>
                </div>
                <span className="text-muted-foreground">{new Date(file.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          file={contextMenu.file}
          x={contextMenu.x}
          y={contextMenu.y}
          canEdit={canEditFile(contextMenu.file)}
          onClose={() => setContextMenu(null)}
          onRename={() => setRenaming({ file: contextMenu.file, name: contextMenu.file.name })}
          onMove={() => setMoving(contextMenu.file)}
          onTags={() => setTagging(contextMenu.file)}
          onDelete={() => deleteFile(contextMenu.file)}
        />
      )}

      {/* Move dialog */}
      {moving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMoving(null)}>
          <div className="w-64 rounded-lg border bg-popover shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-medium text-sm">{t('files_ctx_move')}</p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              <button onClick={() => moveFile(moving, null)} className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted">{t('folders_root')}</button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => moveFile(moving, f.id)} className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted">{f.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tag picker */}
      {tagging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTagging(null)}>
          <div className="w-64 rounded-lg border bg-popover shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-medium text-sm">{t('files_ctx_tags')}</p>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('tags_title')} (admin can create)</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const has = tagging.tags.some((t) => t.tag.id === tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tagging, tag.id)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white transition-opacity ${has ? 'opacity-100 ring-2 ring-offset-1 ring-white' : 'opacity-50 hover:opacity-80'}`}
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview modal */}
      <FilePreviewModal file={previewFile} open={previewOpen} onOpenChange={setPreviewOpen} />

      {/* Delete file confirm */}
      <ConfirmDialog
        open={deleteFileTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteFileTarget(null) }}
        title={t('files_delete_confirm')}
        confirmLabel={t('files_delete_ok')}
        cancelLabel={t('files_delete_cancel')}
        destructive
        onConfirm={confirmDeleteFile}
      />

      {/* Create folder prompt */}
      <PromptDialog
        open={creatingFolderParentId !== undefined}
        onOpenChange={(open) => { if (!open) setCreatingFolderParentId(undefined) }}
        title={t('folders_new')}
        placeholder={t('folders_new_ph')}
        confirmLabel={t('folders_new_submit')}
        cancelLabel={t('folders_new_cancel')}
        onConfirm={confirmCreateFolder}
      />

      {/* Rename folder prompt */}
      <PromptDialog
        open={renamingFolder !== null}
        onOpenChange={(open) => { if (!open) setRenamingFolder(null) }}
        title={t('folders_rename')}
        placeholder={t('folders_rename_ph')}
        initialValue={renamingFolder?.name ?? ''}
        confirmLabel={t('folders_rename_submit')}
        cancelLabel={t('folders_rename_cancel')}
        onConfirm={confirmRenameFolder}
      />

      {/* Delete folder confirm */}
      <ConfirmDialog
        open={deleteFolderTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteFolderTarget(null) }}
        title={t('folders_delete')}
        description={t('folders_delete_warning')}
        confirmLabel={t('folders_delete_ok')}
        cancelLabel={t('folders_delete_cancel')}
        destructive
        onConfirm={confirmDeleteFolder}
      />
    </div>
  )
}
