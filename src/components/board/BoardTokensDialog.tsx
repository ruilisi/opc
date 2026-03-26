'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { KeyRound, Trash2, Copy, Check } from 'lucide-react'

interface BoardToken {
  id: string
  name: string
  createdAt: string
}

interface Props {
  boardId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function BoardTokensDialog({ boardId, open, onOpenChange }: Props) {
  const [tokens, setTokens] = useState<BoardToken[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch(`/api/boards/${boardId}/tokens`)
      .then((r) => r.json())
      .then(setTokens)
      .catch(() => toast.error('Failed to load tokens'))
  }, [boardId, open])

  async function createToken() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/boards/${boardId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTokens((prev) => [{ id: data.id, name: data.name, createdAt: data.createdAt }, ...prev])
      setCreatedToken(data.token)
      setNewName('')
    } catch {
      toast.error('Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  async function revokeToken(tokenId: string) {
    try {
      const res = await fetch(`/api/boards/${boardId}/tokens/${tokenId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setTokens((prev) => prev.filter((t) => t.id !== tokenId))
    } catch {
      toast.error('Failed to revoke token')
    }
  }

  function copyToken() {
    if (!createdToken) return
    navigator.clipboard.writeText(createdToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const apiBase = typeof window !== 'undefined' ? window.location.origin + '/api' : '/api'

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCreatedToken(null) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={16} />
            Agent Access Tokens
          </DialogTitle>
        </DialogHeader>

        {/* One-time token reveal */}
        {createdToken && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4 space-y-3">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Token created — copy it now, it won't be shown again.
            </p>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-white dark:bg-black border rounded px-3 py-2 break-all font-mono">
                {createdToken}
              </code>
              <Button size="icon" variant="outline" onClick={copyToken}>
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Quick start for AI agent:</p>
              <pre className="bg-white dark:bg-black border rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap">{`curl ${apiBase}/agent \\
  -H "Authorization: Bearer ${createdToken}"`}</pre>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setCreatedToken(null)}>
              I've saved my token
            </Button>
          </div>
        )}

        {/* Create new token */}
        {!createdToken && (
          <div className="flex gap-2">
            <Input
              placeholder="Token name (e.g. claude-agent)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createToken()}
            />
            <Button onClick={createToken} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        )}

        {/* Token list */}
        {tokens.length === 0 && !createdToken ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tokens yet. Create one to give an AI agent access to this board.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => revokeToken(t.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tokens are scoped to this board only. An agent using this token cannot access any other board or account data.
        </p>
      </DialogContent>
    </Dialog>
  )
}
