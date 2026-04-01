'use client'

import dynamic from 'next/dynamic'

const DocEditor = dynamic(() => import('@/components/docs/DocEditor'), { ssr: false })

interface Props {
  doc: { id: string; title: string; content: string | null; publicAccess: string }
  slug: string
}

const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? 'ws://localhost:1234'

export default function PublicDocView({ doc, slug }: Props) {
  const readOnly = doc.publicAccess === 'read'
  const token = readOnly ? '' : `public:${slug}`

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center px-6 py-3 border-b shrink-0">
        <h1 className="text-lg font-semibold">{doc.title}</h1>
        {readOnly && <span className="ml-3 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Read-only</span>}
      </header>
      <div className="flex-1 min-h-0 flex flex-col">
        <DocEditor
          docId={doc.id}
          token={token}
          readOnly={readOnly}
          hocuspocusUrl={HOCUSPOCUS_URL}
        />
      </div>
    </div>
  )
}
