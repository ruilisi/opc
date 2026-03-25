'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/shared/AppShell'
import BoardCard from '@/components/board/BoardCard'
import CreateBoardDialog from '@/components/board/CreateBoardDialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function BoardsPage() {
  const [boards, setBoards] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/boards')
      .then((r) => r.json())
      .then(setBoards)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Boards</h1>
          <CreateBoardDialog onCreated={(b) => setBoards((prev) => [b, ...prev])} />
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <p className="text-lg">No boards yet</p>
            <p className="text-sm">Create your first board to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(boards as Parameters<typeof BoardCard>[0]['board'][]).map((b) => (
              <BoardCard key={b.id} board={b} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
