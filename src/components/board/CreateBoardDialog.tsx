'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

interface Org {
  id: string
  name: string
}

interface Props {
  onCreated: (board: unknown) => void
  orgs?: Org[]
}

export default function CreateBoardDialog({ onCreated, orgs = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [orgId, setOrgId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, orgId: orgId || undefined }),
      })
      if (!res.ok) throw new Error('Failed to create board')
      const board = await res.json()
      onCreated(board)
      setOpen(false)
      setName('')
      setDescription('')
      setOrgId('')
      toast.success('Board created')
    } catch {
      toast.error('Failed to create board')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />
        New Board
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Board</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Project" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this board for?" />
            </div>
            {orgs.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="org">Organization (optional)</Label>
                <select
                  id="org"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Personal</option>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Board'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
