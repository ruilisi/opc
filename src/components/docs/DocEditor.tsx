'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Image from '@tiptap/extension-image'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Code, Image as ImageIcon, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DocEditorProps {
  docId: string
  token: string
  readOnly?: boolean
  hocuspocusUrl: string
}

export default function DocEditor({ docId, token, readOnly = false, hocuspocusUrl }: DocEditorProps) {
  // Initialize ydoc once — stable across renders
  const ydocRef = useRef<Y.Doc>(new Y.Doc())
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const [connected, setConnected] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [markdownText, setMarkdownText] = useState('')

  useEffect(() => {
    const provider = new HocuspocusProvider({
      url: hocuspocusUrl,
      name: docId,
      document: ydocRef.current,
      token,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    })
    providerRef.current = provider

    return () => {
      provider.destroy()
      providerRef.current = null
    }
  }, [docId, token, hocuspocusUrl])

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydocRef.current }),
      CollaborationCursor.configure({ provider: providerRef }),
      Image,
    ],
  })

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    return data.url as string
  }

  useEffect(() => {
    if (!editor) return
    const handler = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imageItem = items.find((i) => i.type.startsWith('image/'))
      if (!imageItem) return
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const url = await uploadImage(file)
      editor.chain().focus().setImage({ src: url }).run()
    }
    const dom = editor.view.dom
    dom.addEventListener('paste', handler as unknown as EventListener)
    return () => dom.removeEventListener('paste', handler as unknown as EventListener)
  }, [editor])

  if (!editor) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading editor…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!readOnly && (
        <div className="flex items-center gap-0.5 border-b px-3 py-1.5 flex-wrap shrink-0">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={13} />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={13} />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={13} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code size={13} />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => imageInputRef.current?.click()} title="Insert image">
            <ImageIcon size={13} />
          </Button>
        </div>
      )}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          const url = await uploadImage(file)
          editor.chain().focus().setImage({ src: url }).run()
          e.target.value = ''
        }}
      />
      <div className="flex items-center gap-2 px-3 py-1 border-b text-xs text-muted-foreground shrink-0">
        <span className={cn('size-1.5 rounded-full', connected ? 'bg-green-500' : 'bg-amber-400')} />
        {connected ? 'Live' : 'Connecting…'}
        {!readOnly && (
          <button
            className="ml-auto flex items-center gap-1 hover:text-foreground"
            onClick={() => setShowMarkdown((v) => !v)}
          >
            <FileText size={11} />
            {showMarkdown ? 'Rich text' : 'Markdown'}
          </button>
        )}
      </div>
      {showMarkdown ? (
        <textarea
          className="flex-1 p-4 font-mono text-sm bg-muted/30 resize-none focus:outline-none"
          value={markdownText}
          onChange={(e) => setMarkdownText(e.target.value)}
          placeholder="Markdown source…"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
        />
      )}
    </div>
  )
}
