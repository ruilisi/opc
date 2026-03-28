'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Check, X, Loader } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface OrgResult {
  id: string
  name: string
  slug: string
}

interface Props {
  onCreated: (org: OrgResult) => void
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
  const { t } = useT()

  useEffect(() => {
    if (!slugEdited) setSlug(toSlug(name))
  }, [name, slugEdited])

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
          toast.error(t('create_org_slug_taken_toast'))
          return
        }
        throw new Error(data.error ?? 'Failed')
      }
      onCreated(data)
      setOpen(false)
      reset()
      toast.success(t('create_org_success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('create_org_error'))
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
          {t('create_org_btn')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create_org_title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-name">{t('create_org_name_label')}</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('create_org_name_ph')}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-slug">{t('create_org_slug_label')}</Label>
              <div className="relative">
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugEdited(true) }}
                  placeholder={t('create_org_slug_ph')}
                  className={`pr-8 ${slugState === 'taken' ? 'border-destructive focus-visible:ring-destructive' : slugState === 'available' ? 'border-green-500 focus-visible:ring-green-500' : ''}`}
                  required
                />
                {slugIcon && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{slugIcon}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {slugState === 'taken'
                  ? t('create_org_slug_taken')
                  : slugState === 'available'
                  ? t('create_org_slug_available')
                  : t('create_org_slug_hint')}
              </p>
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !slug || slugState === 'taken' || slugState === 'checking'}
            >
              {loading ? t('create_org_creating') : t('create_org_submit')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
