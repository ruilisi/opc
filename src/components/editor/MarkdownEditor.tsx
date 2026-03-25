'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const MDPreview = dynamic(() => import('@uiw/react-md-editor').then((m) => m.default.Markdown), { ssr: false })

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
}

export default function MarkdownEditor({ value, onChange, placeholder, height = 600 }: Props) {
  const [editing, setEditing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  // Blur: collapse to preview if focus leaves the entire container
  function handleBlur(e: React.FocusEvent) {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <div
        data-color-mode="light"
        onClick={() => setEditing(true)}
        className="w-full min-h-[120px] rounded-md border border-transparent hover:border-border cursor-text transition-colors p-3 group"
      >
        {value ? (
          <MDPreview source={value} style={{ background: 'transparent' }} />
        ) : (
          <span className="text-muted-foreground text-sm">{placeholder ?? 'Click to add description...'}</span>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onPaste={handlePaste}
      onBlur={handleBlur}
      data-color-mode="light"
      className="w-full"
    >
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        height={height}
        autoFocus
        style={{ width: '100%' }}
        textareaProps={{ placeholder }}
      />
    </div>
  )
}
