'use client'

import { useState, useEffect } from 'react'
import AppShell from '@/components/shared/AppShell'
import BoardCard from '@/components/board/BoardCard'
import CreateBoardDialog from '@/components/board/CreateBoardDialog'
import { Skeleton } from '@/components/ui/skeleton'

interface Org {
  id: string
  name: string
}

interface BoardMember {
  user: { id: string; name: string; avatarUrl?: string | null }
}

interface Board {
  id: string
  name: string
  description?: string | null
  orgId?: string | null
  org?: Org | null
  members: BoardMember[]
  _count?: { columns: number }
}

export default function BoardsPage() {
  const [boards, setBoards] = useState<Board[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [filter, setFilter] = useState<string>('all') // 'all' | 'personal' | orgId
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/boards').then((r) => r.json()),
      fetch('/api/orgs').then((r) => r.json()),
    ]).then(([b, o]) => {
      setBoards(b)
      setOrgs(o)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = boards.filter((b) => {
    if (filter === 'all') return true
    if (filter === 'personal') return !b.orgId
    return b.orgId === filter
  })

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Boards</h1>
          <CreateBoardDialog orgs={orgs} onCreated={(b) => setBoards((prev) => [b as Board, ...prev])} />
        </div>

        {orgs.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', name: 'All' },
              { id: 'personal', name: 'Personal' },
              ...orgs.map((o) => ({ id: o.id, name: o.name })),
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  filter === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <p className="text-lg">No boards yet</p>
            <p className="text-sm">Create your first board to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((b) => (
              <BoardCard key={b.id} board={b} onDeleted={() => setBoards((prev) => prev.filter((x) => x.id !== b.id))} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
