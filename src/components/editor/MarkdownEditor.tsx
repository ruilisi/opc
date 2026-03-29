'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const MDPreview = dynamic(() => import('@uiw/react-md-editor').then((m) => m.default.Markdown), { ssr: false })

interface Props {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  height?: number
}

export default function MarkdownEditor({ value, onChange, onBlur, placeholder, height = 600 }: Props) {
  const [editing, setEditing] = useState(false)
  const [fading, setFading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const colorMode = resolvedTheme === 'dark' ? 'dark' : 'light'

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((i) => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()

    const file = imageItem.getAsFile()
    if (!file) return

    const formData = new FormData()
    formData.append('file', file, 'paste.png')

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      const { url } = await res.json()
      onChange(value + `\n![image](${url})\n`)
      toast.success('Image uploaded')
    } catch {
      toast.error('Failed to upload image')
    }
  }, [value, onChange])

  function switchTo(next: boolean) {
    setFading(true)
    setTimeout(() => {
      setEditing(next)
      setFading(false)
    }, 120)
  }

  function handleBlur(e: React.FocusEvent) {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      switchTo(false)
      onBlur?.()
    }
  }

  return (
    <div
      ref={containerRef}
      onPaste={handlePaste}
      onBlur={handleBlur}
      data-color-mode={colorMode}
      className="w-full"
      style={{ transition: 'opacity 120ms ease', opacity: fading ? 0 : 1 }}
    >
      {!editing ? (
        <div
          onClick={() => switchTo(true)}
          className="w-full min-h-[120px] rounded-md border border-transparent hover:border-border cursor-text transition-colors p-3"
        >
          {value ? (
            <MDPreview source={value} style={{ background: 'transparent' }} />
          ) : (
            <span className="text-muted-foreground text-sm">{placeholder ?? 'Click to add description...'}</span>
          )}
        </div>
      ) : (
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? '')}
          height={height}
          autoFocus
          style={{ width: '100%' }}
          textareaProps={{ placeholder }}
        />
      )}
    </div>
  )
}
