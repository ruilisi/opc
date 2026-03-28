'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/shared/UserAvatar'
import DeleteBoardDialog from './DeleteBoardDialog'
import { useT } from '@/lib/i18n'

interface BoardMember {
  role?: string
  user: { id: string; name: string; avatarUrl?: string | null }
}
interface Board {
  id: string
  name: string
  description?: string | null
  members: BoardMember[]
  _count?: { columns: number }
}

export default function BoardCard({ board, onDeleted }: { board: Board; onDeleted?: () => void }) {
  const isOwner = board.members.some((m) => m.role === 'owner')
  const { dict } = useT()

  return (
    <div className="group relative">
      <Link href={`/boards/${board.id}`}>
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base pr-6">{board.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {board.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{board.description}</p>
            )}
            <div className="flex items-center justify-between">
              {board._count && (
                <Badge variant="secondary">
                  {board._count.columns === 1
                    ? dict.boards_columns_one
                    : dict.boards_columns_other(board._count.columns)}
                </Badge>
              )}
              <div className="flex -space-x-2">
                {board.members.slice(0, 5).map(({ user }) => (
                  <UserAvatar key={user.id} name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      {isOwner && (
        <div className="absolute right-3 top-3">
          <DeleteBoardDialog
            board={board}
            onDeleted={() => onDeleted?.()}
          />
        </div>
      )}
    </div>
  )
}
