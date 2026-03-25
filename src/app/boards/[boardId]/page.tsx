import { notFound } from 'next/navigation'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import KanbanBoard from '@/components/board/KanbanBoard'
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
      columns: {
        orderBy: { order: 'asc' },
        include: {
          tasks: {
            orderBy: { order: 'asc' },
            include: {
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  })

  if (!board) notFound()

  return (
    <AppShell>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center border-b px-6 py-3 shrink-0">
          <h1 className="text-xl font-bold">{board.name}</h1>
          {board.description && (
            <p className="ml-4 text-sm text-muted-foreground">{board.description}</p>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <KanbanBoard boardId={board.id} initialColumns={board.columns as Parameters<typeof KanbanBoard>[0]['initialColumns']} />
        </div>
      </div>
    </AppShell>
  )
}
