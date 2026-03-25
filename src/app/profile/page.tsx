'use client'

import React, { useState, useEffect } from 'react'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import UserAvatar from '@/components/shared/UserAvatar'
import { toast } from 'sonner'

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

  useEffect(() => {
    fetch('/api/users/me').then((r) => r.json()).then((u) => {
      setUser(u)
      setName(u.name)
    })
  }, [])

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
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="p-6 max-w-lg">
        <h1 className="mb-6 text-2xl font-bold">Profile</h1>
        {user && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
                <div>
                  <CardTitle>{user.name}</CardTitle>
                  {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}
