'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Link, Copy } from 'lucide-react'

interface Props {
  orgId: string
}

export default function InviteLinkCard({ orgId }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/invites`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setUrl(data.url)
    } catch {
      toast.error('Failed to generate invite link')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!url) return
    await navigator.clipboard.writeText(url)
    toast.success('Link copied!')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link size={14} />
        Invite Members
      </div>
      {url ? (
        <div className="flex gap-2">
          <Input value={url} readOnly className="text-xs" />
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy size={14} />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Invite Link'}
        </Button>
      )}
    </div>
  )
}
