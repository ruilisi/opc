'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import InviteLinkCard from '@/components/org/InviteLinkCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { UserX } from 'lucide-react'
import { useT } from '@/lib/i18n'

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
  const { t } = useT()
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
      toast.success(t('org_rename_success'))
    } catch {
      toast.error(t('org_rename_error'))
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
        toast.error(err.error ?? t('org_delete_error'))
        return
      }
      toast.success(t('org_delete_success'))
      router.push('/')
    } catch {
      toast.error(t('org_delete_error'))
    } finally {
      setDeleting(false)
    }
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/orgs/${orgId}/members/${userId}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? t('org_remove_member_error'))
      return
    }
    setOrg((prev) =>
      prev ? { ...prev, members: prev.members.filter((m) => m.user.id !== userId) } : prev
    )
    toast.success(t('org_remove_member_success'))
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
        <div className="p-6 text-muted-foreground">{t('org_not_found')}</div>
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
            <h2 className="text-sm font-semibold">{t('org_rename_section')}</h2>
            <form onSubmit={handleRename} className="flex gap-2">
              <Label htmlFor="org-name" className="sr-only">{t('org_rename_section')}</Label>
              <Input
                id="org-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" variant="outline" size="sm" disabled={renaming || !newName.trim() || newName.trim() === org.name}>
                {renaming ? t('org_saving') : t('org_save')}
              </Button>
            </form>
          </div>
        )}

        {myRole === 'owner' && !isPersonal && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4">
            <h2 className="text-sm font-semibold text-destructive">{t('org_danger_zone')}</h2>
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-sm">{t('org_delete_confirm')}</span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? t('org_deleting') : t('org_delete_yes')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  {t('org_cancel')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="destructive" className="w-fit" onClick={() => setConfirmDelete(true)}>
                {t('org_delete_btn')}
              </Button>
            )}
          </div>
        )}

        {!isPersonal && (
          <>
            {myRole === 'owner' && <InviteLinkCard orgId={orgId} />}

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('org_members_section')} ({org.members.length})
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
