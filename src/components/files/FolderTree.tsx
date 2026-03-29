'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import type { OrgFolder } from '@/types'
import { useT } from '@/lib/i18n'

interface Props {
  folders: OrgFolder[]
  selectedId: string | null  // null = root
  onSelect: (folderId: string | null) => void
  onCreateFolder: (parentId: string | null) => void
  onRenameFolder: (folder: OrgFolder) => void
  onDeleteFolder: (folder: OrgFolder) => void
  canManage: boolean  // admin or owner
}

function buildTree(folders: OrgFolder[]): OrgFolder[] {
  const map = new Map(folders.map((f) => [f.id, { ...f, children: [] as OrgFolder[] }]))
  const roots: OrgFolder[] = []
  for (const f of map.values()) {
    if (f.parentId) map.get(f.parentId)?.children?.push(f)
    else roots.push(f)
  }
  return roots
}

function FolderNode({
  folder,
  selectedId,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  canManage,
}: Omit<Props, 'folders'> & { folder: OrgFolder }) {
  const [expanded, setExpanded] = useState(false)
  const children = (folder.children ?? []) as OrgFolder[]
  const isSelected = selectedId === folder.id

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
        onClick={() => onSelect(folder.id)}
      >
        <button
          className="shrink-0 text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
        >
          {children.length > 0
            ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="inline-block w-3" />}
        </button>
        {isSelected ? <FolderOpen size={14} className="shrink-0 text-primary" /> : <Folder size={14} className="shrink-0 text-muted-foreground" />}
        <span className="flex-1 truncate">{folder.name}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); onCreateFolder(folder.id) }} className="rounded p-0.5 hover:bg-accent-foreground/10"><Plus size={11} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRenameFolder(folder) }} className="rounded p-0.5 hover:bg-accent-foreground/10"><Pencil size={11} /></button>
          {canManage && <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder) }} className="rounded p-0.5 hover:bg-destructive/10 text-destructive"><Trash2 size={11} /></button>}
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div className="pl-4">
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} selectedId={selectedId} onSelect={onSelect} onCreateFolder={onCreateFolder} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FolderTree({ folders, selectedId, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder, canManage }: Props) {
  const { t } = useT()
  const tree = buildTree(folders)

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none ${selectedId === null ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}
        onClick={() => onSelect(null)}
      >
        <FolderOpen size={14} className="shrink-0" />
        {t('folders_root')}
      </div>
      {tree.map((folder) => (
        <FolderNode key={folder.id} folder={folder} selectedId={selectedId} onSelect={onSelect} onCreateFolder={onCreateFolder} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} canManage={canManage} />
      ))}
      <button
        onClick={() => onCreateFolder(null)}
        className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus size={12} />
        {t('folders_new')}
      </button>
    </div>
  )
}
