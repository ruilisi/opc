'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Hook for imperative usage
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    description?: string
    resolve: (value: boolean) => void
  }>({ open: false, title: '', resolve: () => {} })

  function confirm(title: string, description?: string): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ open: true, title, description, resolve })
    })
  }

  function handleConfirm() {
    state.resolve(true)
    setState((s) => ({ ...s, open: false }))
  }

  function handleCancel() {
    state.resolve(false)
    setState((s) => ({ ...s, open: false }))
  }

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
