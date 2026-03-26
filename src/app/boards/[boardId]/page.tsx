import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import KanbanBoard from '@/components/board/KanbanBoard'
import BoardHeader from '@/components/board/BoardHeader'
import AppShell from '@/components/shared/AppShell'

interface Props {
  params: Promise<{ boardId: string }>
}

export default async function BoardPage({ params }: Props) {
  const session = await getSession()
  if (!session) notFound()

  const { boardId } = await params

  const board = await prisma.board.findFirst({
    where: { id: boardId, members: { some: { userId: session.sub } } },
    include: {
      members: { where: { userId: session.sub }, select: { role: true } },
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
              labels: { include: { label: { select: { id: true, name: true, color: true } } } },
              _count: { select: { checklist: true, attachments: true, comments: true } },
              checklist: { where: { checked: true }, select: { id: true, checked: true, text: true, order: true } },
            },
          },
        },
      },
    },
  })

  if (!board) notFound()

  const isOwner = board.members[0]?.role === 'owner'

  return (
    <AppShell>
      <div className="flex flex-col h-full min-h-0">
        <BoardHeader
          boardId={board.id}
          name={board.name}
          description={board.description}
          isOwner={isOwner}
        />
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard boardId={board.id} initialColumns={board.columns as Parameters<typeof KanbanBoard>[0]['initialColumns']} />
        </div>
      </div>
    </AppShell>
  )
}
