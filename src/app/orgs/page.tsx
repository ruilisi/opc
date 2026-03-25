'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppShell from '@/components/shared/AppShell'
import CreateOrgDialog from '@/components/org/CreateOrgDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Users } from 'lucide-react'

interface Org {
  id: string
  name: string
  _count: { members: number }
  members: { role: string }[]
}

export default function OrgsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const alreadyOwns = orgs.some((o) => o.members?.[0]?.role === 'owner')

  useEffect(() => {
    fetch('/api/orgs')
      .then((r) => r.json())
      .then(setOrgs)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Organizations</h1>
          {!alreadyOwns && <CreateOrgDialog onCreated={(org) => setOrgs((prev) => [org as Org, ...prev])} />}
        </div>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <p className="text-lg">No organizations yet</p>
            <p className="text-sm">Create one to collaborate with your team.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/orgs/${org.id}`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{org.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {org.members?.[0]?.role ?? 'member'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users size={14} />
                  {org._count.members}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
