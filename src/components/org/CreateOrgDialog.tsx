'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Check, X, Loader } from 'lucide-react'

interface OrgResult {
  id: string
  name: string
  slug: string
}

interface Props {
  onCreated: (org: OrgResult) => void
  // Controlled mode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type SlugState = 'idle' | 'checking' | 'available' | 'taken'

export default function CreateOrgDialog({ onCreated, open: openProp, onOpenChange }: Props) {
  const [openInternal, setOpenInternal] = useState(false)
  const open = openProp !== undefined ? openProp : openInternal
  const setOpen = (v: boolean) => { setOpenInternal(v); onOpenChange?.(v) }
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugState, setSlugState] = useState<SlugState>('idle')
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-derive slug from name unless user edited it manually
  useEffect(() => {
    if (!slugEdited) setSlug(toSlug(name))
  }, [name, slugEdited])

  // Debounced availability check
  useEffect(() => {
    if (!slug) { setSlugState('idle'); return }
    setSlugState('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/orgs/check-slug?slug=${encodeURIComponent(slug)}`)
      const { available } = await res.json()
      setSlugState(available ? 'available' : 'taken')
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [slug])

  function reset() {
    setName(''); setSlug(''); setSlugEdited(false); setSlugState('idle')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!name.trim() || slugState === 'taken' || slugState === 'checking') return
    setLoading(true)
    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'slug_taken') {
          setSlugState('taken')
          toast.error('That URL is already taken — try another')
          return
        }
        throw new Error(data.error ?? 'Failed')
      }
      onCreated(data)
      setOpen(false)
      reset()
      toast.success('Organization created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create organization')
    } finally {
      setLoading(false)
    }
  }

  const slugIcon = {
    idle: null,
    checking: <Loader size={13} className="animate-spin text-muted-foreground" />,
    available: <Check size={13} className="text-green-500" />,
    taken: <X size={13} className="text-destructive" />,
  }[slugState]

  return (
    <>
      {openProp === undefined && (
        <Button onClick={() => setOpen(true)}>
          <Plus size={16} />
          New Organization
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-slug">URL identifier</Label>
              <div className="relative">
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugEdited(true) }}
                  placeholder="acme-corp"
                  className={`pr-8 ${slugState === 'taken' ? 'border-destructive focus-visible:ring-destructive' : slugState === 'available' ? 'border-green-500 focus-visible:ring-green-500' : ''}`}
                  required
                />
                {slugIcon && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{slugIcon}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {slugState === 'taken'
                  ? 'This identifier is already taken. Please choose another.'
                  : slugState === 'available'
                  ? 'This identifier is available.'
                  : "Used in URLs and can't be changed later."}
              </p>
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !slug || slugState === 'taken' || slugState === 'checking'}
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
