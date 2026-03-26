'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { KeyRound } from 'lucide-react'
import BoardTokensDialog from './BoardTokensDialog'

interface Props {
  boardId: string
  name: string
  description?: string | null
  isOwner: boolean
}

export default function BoardHeader({ boardId, name, description, isOwner }: Props) {
  const [tokensOpen, setTokensOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3 border-b px-6 py-3 shrink-0">
        <h1 className="text-xl font-bold">{name}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setTokensOpen(true)}
            >
              <KeyRound size={14} />
              Agent Tokens
            </Button>
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
