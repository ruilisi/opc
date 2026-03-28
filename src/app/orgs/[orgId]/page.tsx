'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import InviteLinkCard from '@/components/org/InviteLinkCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { UserX } from 'lucide-react'

interface Member {
  id: string
  role: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

interface Org {
  id: string
  name: string
  type: string
  members: Member[]
  myRole: string
}

export default function OrgSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const router = useRouter()
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string>('member')
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}`)
      .then((r) => r.json())
      .then((data: Org) => {
        setOrg(data)
        setMyRole(data.myRole ?? 'member')
        setNewName(data.name)
      })
      .finally(() => setLoading(false))
  }, [orgId])

  async function handleRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!newName.trim() || newName.trim() === org?.name) return
    setRenaming(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      if (!res.ok) throw new Error('Failed to rename')
      const updated = await res.json()
      setOrg((prev) => prev ? { ...prev, name: updated.name } : prev)
      toast.success('Organization renamed')
    } catch {
      toast.error('Failed to rename organization')
    } finally {
      setRenaming(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to delete organization')
        return
      }
      toast.success('Organization deleted')
      router.push('/')
    } catch {
      toast.error('Failed to delete organization')
    } finally {
      setDeleting(false)
    }
  }

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

  const isPersonal = org.type === 'personal'

  return (
    <AppShell>
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold">{org.name}</h1>

        {myRole === 'owner' && (
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Rename</h2>
            <form onSubmit={handleRename} className="flex gap-2">
              <Label htmlFor="org-name" className="sr-only">Name</Label>
              <Input
                id="org-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" variant="outline" size="sm" disabled={renaming || !newName.trim() || newName.trim() === org.name}>
                {renaming ? 'Saving...' : 'Save'}
              </Button>
            </form>
          </div>
        )}

        {myRole === 'owner' && !isPersonal && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
            <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-sm">Delete this organization and all its boards? This cannot be undone.</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Deleting...' : 'Yes, delete'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="destructive" className="w-fit" onClick={() => setConfirmDelete(true)}>
                Delete Organization
              </Button>
            )}
          </div>
        )}

        {!isPersonal && (
          <>
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
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
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
          </>
        )}
      </div>
    </AppShell>
  )
}
