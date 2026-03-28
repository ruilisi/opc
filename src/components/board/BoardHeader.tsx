'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound, FolderOpen, Check, X } from 'lucide-react'
import BoardTokensDialog from './BoardTokensDialog'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'

interface Props {
  boardId: string
  name: string
  description?: string | null
  isOwner: boolean
  basePath?: string | null
}

export default function BoardHeader({ boardId, name, description, isOwner, basePath: initialBasePath }: Props) {
  const [tokensOpen, setTokensOpen] = useState(false)
  const [editingPath, setEditingPath] = useState(false)
  const [basePath, setBasePath] = useState(initialBasePath ?? '')
  const [savedPath, setSavedPath] = useState(initialBasePath ?? '')
  const { t } = useT()

  async function savePath() {
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePath: basePath.trim() || null }),
      })
      if (!res.ok) throw new Error('Failed')
      setSavedPath(basePath.trim())
      setEditingPath(false)
    } catch {
      toast.error(t('board_base_folder_error'))
    }
  }

  function cancelEdit() {
    setBasePath(savedPath)
    setEditingPath(false)
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b px-6 py-3 shrink-0">
        <h1 className="text-xl font-bold">{name}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isOwner && (
            <>
              {editingPath ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={basePath}
                    onChange={(e) => setBasePath(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') savePath(); if (e.key === 'Escape') cancelEdit() }}
                    placeholder="~/Projects/myapp"
                    className="h-7 w-56 text-xs"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="size-7" onClick={savePath}>
                    <Check size={13} />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-7" onClick={cancelEdit}>
                    <X size={13} />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setEditingPath(true)}
                >
                  <FolderOpen size={14} />
                  {savedPath ? (
                    <span className="max-w-48 truncate text-xs font-mono">{savedPath}</span>
                  ) : (
                    t('board_base_folder')
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setTokensOpen(true)}
              >
                <KeyRound size={14} />
                {t('board_agent_tokens')}
              </Button>
            </>
          )}
        </div>
      </div>
      {isOwner && (
        <BoardTokensDialog
          boardId={boardId}
          open={tokensOpen}
          onOpenChange={setTokensOpen}
        />
      )}
    </>
  )
}
