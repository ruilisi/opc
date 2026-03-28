'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Link, Copy, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Props {
  orgId: string
}

const EXPIRY_OPTIONS = [
  { hours: 1, key: 'invite_expires_1h' as const },
  { hours: 24, key: 'invite_expires_24h' as const },
  { hours: 168, key: 'invite_expires_7d' as const },
  { hours: 720, key: 'invite_expires_30d' as const },
]

export default function InviteLinkCard({ orgId }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expiresIn, setExpiresIn] = useState(24)
  const [maxUses, setMaxUses] = useState('')
  const { t } = useT()

  async function generate() {
    setLoading(true)
    try {
      const body: Record<string, number> = { expiresIn }
      const parsed = parseInt(maxUses)
      if (!isNaN(parsed) && parsed > 0) body.maxUses = parsed
      const res = await fetch(`/api/orgs/${orgId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setUrl(data.url)
    } catch {
      toast.error(t('invite_error'))
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success(t('invite_copied'))
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link size={14} />
        {t('invite_title')}
      </div>

      {!url ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">{t('invite_expires_label')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.hours}
                  onClick={() => setExpiresIn(opt.hours)}
                  className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                    expiresIn === opt.hours
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {t(opt.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-max-uses" className="text-xs">{t('invite_max_uses_label')}</Label>
            <Input
              id="invite-max-uses"
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="∞"
              className="max-w-[8rem] text-sm"
            />
          </div>

          <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="w-fit">
            {loading ? t('invite_generating') : t('invite_generate')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input value={url} readOnly className="text-xs" />
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy size={14} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setUrl(null)} title={t('invite_regenerate')}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
