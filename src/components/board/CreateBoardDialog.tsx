'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Props {
  orgId: string
  onCreated: (board: unknown) => void
}

export default function CreateBoardDialog({ orgId, onCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { t } = useT()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, orgId }),
      })
      if (!res.ok) throw new Error('Failed to create board')
      const board = await res.json()
      onCreated(board)
      setOpen(false)
      setName('')
      setDescription('')
      toast.success(t('create_board_success'))
    } catch {
      toast.error(t('create_board_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        {t('boards_new')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create_board_title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('create_board_name')}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('create_board_name_ph')} required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">{t('create_board_desc')}</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('create_board_desc_ph')} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t('create_board_creating') : t('create_board_submit')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
