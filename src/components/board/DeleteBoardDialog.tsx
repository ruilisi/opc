'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Props {
  board: { id: string; name: string }
  onDeleted: () => void
}

export default function DeleteBoardDialog({ board, onDeleted }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useT()

  async function handleDelete() {
    if (confirmation !== board.name) return
    setLoading(true)
    try {
      const res = await fetch(`/api/boards/${board.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success(t('delete_board_success'))
      setOpen(false)
      onDeleted()
    } catch {
      toast.error(t('delete_board_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); setOpen(true) }}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
        aria-label={t('delete_board_title')}
      >
        <Trash2 size={14} />
      </button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); setConfirmation('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_board_title')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {t('delete_board_warning')}
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-name">
                {t('delete_board_confirm_prefix')} <span className="font-mono font-semibold text-foreground">{board.name}</span> {t('delete_board_confirm_suffix')}
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
              {loading ? t('delete_board_deleting') : t('delete_board_submit')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
