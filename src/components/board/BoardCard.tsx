'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/shared/UserAvatar'

interface BoardMember {
  user: { id: string; name: string; avatarUrl?: string | null }
}
interface Board {
  id: string
  name: string
  description?: string | null
  members: BoardMember[]
  _count?: { columns: number }
}

export default function BoardCard({ board }: { board: Board }) {
  return (
    <Link href={`/boards/${board.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{board.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {board.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{board.description}</p>
          )}
          <div className="flex items-center justify-between">
            {board._count && (
              <Badge variant="secondary">{board._count.columns} columns</Badge>
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
  )
}
