'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/shared/AppShell'
import BoardCard from '@/components/board/BoardCard'
import CreateBoardDialog from '@/components/board/CreateBoardDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useT } from '@/lib/i18n'

interface BoardMember {
  user: { id: string; name: string; avatarUrl?: string | null }
}

interface Board {
  id: string
  name: string
  description?: string | null
  orgId: string
  org?: { id: string; name: string } | null
  members: BoardMember[]
  _count?: { columns: number }
}

function BoardsContent() {
  const { activeOrg, loading: workspaceLoading } = useWorkspace()
  const { t } = useT()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (workspaceLoading || !activeOrg) return
    setLoading(true)
    fetch(`/api/boards?orgId=${activeOrg.id}`)
      .then((r) => r.json())
      .then(setBoards)
      .finally(() => setLoading(false))
  }, [activeOrg?.id, workspaceLoading])

  const isLoading = workspaceLoading || loading

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('boards_title')}</h1>
        {activeOrg && (
          <CreateBoardDialog
            orgId={activeOrg.id}
            onCreated={(b) => setBoards((prev) => [b as Board, ...prev])}
          />
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p className="text-lg">{t('boards_empty_title')}</p>
          <p className="text-sm">{t('boards_empty_desc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((b) => (
            <BoardCard key={b.id} board={b} onDeleted={() => setBoards((prev) => prev.filter((x) => x.id !== b.id))} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function BoardsPage() {
  return (
    <AppShell>
      <BoardsContent />
    </AppShell>
  )
}
