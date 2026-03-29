'use client'

import { useEffect, useRef } from 'react'
import { Link2, Pencil, FolderInput, Tag, Download, Trash2 } from 'lucide-react'
import type { OrgFile } from '@/types'
import { useT } from '@/lib/i18n'

type MenuItem = {
  icon: React.ElementType
  label: string
  action: () => void
  show: boolean
  danger?: boolean
} | null

interface Props {
  file: OrgFile
  x: number
  y: number
  canEdit: boolean
  onClose: () => void
  onRename: () => void
  onMove: () => void
  onTags: () => void
  onDelete: () => void
}

export default function FileContextMenu({ file, x, y, canEdit, onClose, onRename, onMove, onTags, onDelete }: Props) {
  const { t } = useT()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  function copyLink() {
    navigator.clipboard.writeText(file.url)
    onClose()
  }

  const items: MenuItem[] = [
    { icon: Link2, label: t('files_ctx_copy_link'), action: copyLink, show: true },
    { icon: Pencil, label: t('files_ctx_rename'), action: () => { onRename(); onClose() }, show: canEdit },
    { icon: FolderInput, label: t('files_ctx_move'), action: () => { onMove(); onClose() }, show: canEdit },
    { icon: Tag, label: t('files_ctx_tags'), action: () => { onTags(); onClose() }, show: canEdit },
    null, // separator
    { icon: Download, label: t('files_ctx_download'), action: () => { window.open(file.url, '_blank'); onClose() }, show: true },
    null, // separator
    { icon: Trash2, label: t('files_ctx_delete'), action: () => { onDelete(); onClose() }, show: canEdit, danger: true },
  ]

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-44 rounded-md border bg-popover shadow-lg py-1"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={`separator-${i}`} className="my-1 border-t" />
        ) : item.show ? (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent ${item.danger ? 'text-destructive hover:text-destructive' : ''}`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ) : null
      )}
    </div>
  )
}
