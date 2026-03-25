'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface InviteInfo {
  valid: boolean
  org?: { id: string; name: string }
  reason?: string
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then(setInfo)
      .finally(() => setLoading(false))
  }, [token])

  async function accept() {
    setAccepting(true)
    try {
      const res = await fetch(`/api/invites/${token}/accept`, { method: 'POST' })
      if (res.status === 401) {
        router.push(`/login?return=/invite/${token}`)
        return
      }
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to join')
        return
      }
      toast.success(`Joined ${info?.org?.name}!`)
      router.push('/boards')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading invite...</p>
      </div>
    )
  }

  if (!info?.valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Invalid or Expired Invite</h1>
        <p className="text-muted-foreground">This invite link is no longer valid.</p>
        <Button variant="outline" onClick={() => router.push('/boards')}>
          Go to Boards
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">You&apos;re invited!</h1>
        <p className="text-muted-foreground">
          Join <span className="font-semibold text-foreground">{info.org?.name}</span> on OPC
        </p>
      </div>
      <Button onClick={accept} disabled={accepting} size="lg">
        {accepting ? 'Joining...' : 'Accept & Join'}
      </Button>
    </div>
  )
}
