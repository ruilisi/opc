'use client'

import React, { useState, useEffect } from 'react'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'

interface User {
  id: string
  name: string
  email?: string | null
  avatarUrl?: string | null
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const { t } = useT()

  useEffect(() => {
    fetch('/api/users/me').then((r) => r.json()).then((u) => {
      setUser(u)
      setName(u.name)
    })
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { url } = await uploadRes.json()
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: url }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setUser(updated)
      toast.success('Avatar updated')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Failed')
      const updated = await res.json()
      setUser(updated)
      toast.success(t('profile_success'))
    } catch {
      toast.error(t('profile_error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-lg">
        <h1 className="mb-6 text-2xl font-bold">{t('profile_title')}</h1>
        {user && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <label className="relative cursor-pointer group shrink-0">
                  <div className="size-16 rounded-full overflow-hidden">
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
                      : <div className="size-full flex items-center justify-center bg-muted text-lg font-semibold">{user.name.slice(0, 2).toUpperCase()}</div>
                    }
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">{uploadingAvatar ? '…' : 'Edit'}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">{t('profile_display_name')}</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? t('profile_saving') : t('profile_save')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
