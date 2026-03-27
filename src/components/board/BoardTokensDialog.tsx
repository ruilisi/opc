'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { KeyRound, Trash2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [expandedTokenId, setExpandedTokenId] = useState<string | null>(null)
  const [copiedExistingPrompt, setCopiedExistingPrompt] = useState<string | null>(null)

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

  function buildPrompt(token: string) {
    return `You are a task execution agent with access to a project board via REST API.

## Your access

Base URL: ${apiBase}
Auth header: Authorization: Bearer ${token}

## Getting started

First, call GET ${apiBase}/agent to load the full board. You will receive:
- All columns (e.g. Todo, In Progress, Done)
- All tasks with title, content, checklist, due dates, labels
- A meta.actions map describing every available operation

## Your job

1. Call GET ${apiBase}/agent to orient yourself
2. Pick the highest priority task from the Todo column (use labels, due dates, points as signals)
3. Move it to In Progress: PATCH ${apiBase}/tasks/{taskId}/move  body: {"columnId": "<in_progress_col_id>"}
4. Add a comment to say what you're doing: POST ${apiBase}/tasks/{taskId}/comments  body: {"content": "Starting: <your plan>"}
5. Do the work
6. Tick off checklist items as you complete them: PATCH ${apiBase}/tasks/{taskId}/checklist/{itemId}  body: {"checked": true}
7. When done, add a summary comment and move the task to Done
8. Repeat with the next task

## Rules
- Always add a comment before starting a task so humans can follow your progress
- Never delete tasks unless explicitly instructed
- If blocked, add a comment explaining why and move the task back to Todo
- Prefer updating task content with your findings rather than just commenting`
  }

  function copyPrompt() {
    if (!createdToken) return
    navigator.clipboard.writeText(buildPrompt(createdToken))
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setCreatedToken(null) }}>
      <DialogContent className="max-w-lg w-[min(90vw,512px)] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound size={16} />
            Agent Access Tokens
          </DialogTitle>
        </DialogHeader>

        {/* One-time token reveal */}
        {createdToken && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4 space-y-3 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Token created — copy it now, it won't be shown again.
            </p>
            <div className="flex gap-2 items-start min-w-0">
              <code className="flex-1 min-w-0 text-xs bg-white dark:bg-black border rounded px-3 py-2 break-all font-mono leading-relaxed">
                {createdToken}
              </code>
              <Button size="icon" variant="outline" onClick={copyToken}>
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Paste this prompt into Claude or any AI agent:</p>
              <div className="relative">
                <pre className="bg-white dark:bg-zinc-900 border rounded p-3 text-xs overflow-y-auto max-h-40 whitespace-pre-wrap break-all font-mono leading-relaxed w-full min-w-0">
                  {buildPrompt(createdToken)}
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2 gap-1.5"
                  onClick={copyPrompt}
                >
                  {copiedPrompt ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copiedPrompt ? 'Copied!' : 'Copy prompt'}
                </Button>
              </div>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => setCreatedToken(null)}>
              Done
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
          <div className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden">
            {tokens.map((t) => (
              <div key={t.id} className="rounded-md border min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => setExpandedTokenId(expandedTokenId === t.id ? null : t.id)}
                  >
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground"
                      onClick={() => setExpandedTokenId(expandedTokenId === t.id ? null : t.id)}
                    >
                      {expandedTokenId === t.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => revokeToken(t.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
                {expandedTokenId === t.id && (
                  <div className="border-t px-3 py-3 space-y-2 bg-muted/30">
                    <p className="text-xs text-muted-foreground">
                      The token value was only shown once. Paste it into the placeholder below before copying.
                    </p>
                    <div className="relative">
                      <pre className="bg-white dark:bg-zinc-900 border rounded p-3 text-xs overflow-y-auto max-h-36 whitespace-pre-wrap break-all font-mono leading-relaxed w-full min-w-0">
                        {buildPrompt('<YOUR_TOKEN_HERE>')}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 gap-1.5"
                        onClick={() => {
                          navigator.clipboard.writeText(buildPrompt('<YOUR_TOKEN_HERE>'))
                          setCopiedExistingPrompt(t.id)
                          setTimeout(() => setCopiedExistingPrompt(null), 2000)
                        }}
                      >
                        {copiedExistingPrompt === t.id ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                        {copiedExistingPrompt === t.id ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                )}
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
