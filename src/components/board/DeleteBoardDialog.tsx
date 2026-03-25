'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

interface Props {
  board: { id: string; name: string }
  onDeleted: () => void
}

export default function DeleteBoardDialog({ board, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (confirmation !== board.name) return
    setLoading(true)
    try {
      const res = await fetch(`/api/boards/${board.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Board deleted')
      setOpen(false)
      onDeleted()
    } catch {
      toast.error('Failed to delete board')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true) }}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label="Delete board"
      >
        <Trash2 size={14} />
      </button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirmation('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete board</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              This action is <span className="font-semibold text-foreground">permanent</span> and cannot be undone.
              All columns and tasks inside will be deleted.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-name">
                Type <span className="font-mono font-semibold text-foreground">{board.name}</span> to confirm
              </Label>
              <Input
                id="confirm-name"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={board.name}
                autoComplete="off"
              />
            </div>
            <Button
              variant="destructive"
              disabled={confirmation !== board.name || loading}
              onClick={handleDelete}
            >
              {loading ? 'Deleting...' : 'Delete this board'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
