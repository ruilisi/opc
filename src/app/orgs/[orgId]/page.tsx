'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import InviteLinkCard from '@/components/org/InviteLinkCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { UserX } from 'lucide-react'

interface Member {
  id: string
  role: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

interface Org {
  id: string
  name: string
  members: Member[]
  myRole: string
}

export default function OrgSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string>('member')

  useEffect(() => {
    fetch(`/api/orgs/${orgId}`)
      .then((r) => r.json())
      .then((data: Org) => {
        setOrg(data)
        setMyRole(data.myRole ?? 'member')
      })
      .finally(() => setLoading(false))
  }, [orgId])

  async function removeMember(userId: string) {
    const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to remove member')
      return
    }
    setOrg((prev) =>
      prev ? { ...prev, members: prev.members.filter((m) => m.user.id !== userId) } : prev
    )
    toast.success('Member removed')
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex flex-col gap-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppShell>
    )
  }

  if (!org) {
    return (
      <AppShell>
        <div className="p-6 text-muted-foreground">Organization not found.</div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold">{org.name}</h1>

        {myRole === 'owner' && <InviteLinkCard orgId={orgId} />}

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Members ({org.members.length})
          </h2>
          {org.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                {m.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.user.avatarUrl} alt={m.user.name} className="size-8 rounded-full" />
                ) : (
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {m.user.name[0]}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{m.user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                </div>
              </div>
              {myRole === 'owner' && m.role !== 'owner' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeMember(m.user.id)}
                >
                  <UserX size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
