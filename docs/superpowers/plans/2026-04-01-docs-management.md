# Docs Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collaborative document editing to OPC — org-level docs with WYSIWYG+markdown, live cursors (Yjs/Hocuspocus), owner-controlled permissions, and optional public read/edit links.

**Architecture:** Hocuspocus WebSocket server (port 1234) handles CRDT sync and persists Yjs binary state to PostgreSQL. Next.js serves the Tiptap editor client that connects to Hocuspocus. Public links use a `public:<slug>` auth token so anonymous users can edit without a session.

**Tech Stack:** Tiptap, Yjs, Hocuspocus, `@hocuspocus/extension-database`, Prisma 7, Next.js 16 App Router, shadcn/ui, Tailwind v4.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Edit | Add `Doc`, `DocPermission` models + back-relations on `Organization` and `User` |
| `prisma/migrations/*/migration.sql` | Create | `ALTER TABLE` for new models |
| `src/lib/slug.ts` | Create | Extract `generateSlug(length)` for reuse across forms + docs |
| `src/app/api/boards/[boardId]/forms/route.ts` | Edit | Import `generateSlug` from `src/lib/slug.ts` instead of inline |
| `server/hocuspocus.ts` | Create | Hocuspocus WebSocket server: auth, load/store Y.Doc from DB |
| `server/tsconfig.json` | Create | TypeScript config for the server directory |
| `Makefile` | Edit | `dev` target starts Next.js + Hocuspocus in parallel |
| `src/proxy.ts` | Edit | Add `/d/` and `/api/docs/` to `PUBLIC_PATHS` |
| `src/components/docs/DocEditor.tsx` | Create | Tiptap client component: Collaboration, CollaborationCursor, Markdown, Image |
| `src/app/api/orgs/[orgId]/docs/route.ts` | Create | GET list + POST create |
| `src/app/api/orgs/[orgId]/docs/[docId]/route.ts` | Create | GET + PATCH + DELETE |
| `src/app/api/orgs/[orgId]/docs/[docId]/permissions/route.ts` | Create | GET + POST + DELETE per-user permissions |
| `src/app/api/docs/[docId]/route.ts` | Create | Public GET — validates `publicAccess != null` |
| `src/app/orgs/[orgId]/docs/page.tsx` | Create | Doc list page |
| `src/app/orgs/[orgId]/docs/[docId]/page.tsx` | Create | Editor page with sidebar |
| `src/app/d/[slug]/page.tsx` | Create | Public doc page (read or edit) |
| `src/components/shared/AppShell.tsx` | Edit | Add "Docs" nav item |

---

## Chunk 1: Dependencies, Schema, Slug Utility

### Task 1: Install dependencies

- [ ] Run:
```bash
cd /Users/alex/Projects/opc
bun add @hocuspocus/server @hocuspocus/extension-database \
  @tiptap/core @tiptap/starter-kit \
  @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor \
  @tiptap/extension-image \
  yjs y-prosemirror
bun add -d ts-node @types/node
```
- [ ] Verify no install errors.

### Task 2: Extract slug utility

- [ ] Create `src/lib/slug.ts`:
```typescript
import { prisma } from '@/lib/prisma'

/**
 * Generate a unique random slug of `length` chars (a-z0-9).
 * Checks for uniqueness against the given Prisma finder.
 */
export async function generateUniqueSlug(
  length: number,
  isUnique: (slug: string) => Promise<boolean>
): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  while (true) {
    const slug = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    if (await isUnique(slug)) return slug
  }
}

export async function generateFormSlug(): Promise<string> {
  return generateUniqueSlug(5, async (slug) => {
    const existing = await prisma.boardForm.findUnique({ where: { slug } })
    return !existing
  })
}

export async function generateDocSlug(): Promise<string> {
  return generateUniqueSlug(5, async (slug) => {
    const existing = await prisma.doc.findUnique({ where: { slug } })
    return !existing
  })
}
```

- [ ] Edit `src/app/api/boards/[boardId]/forms/route.ts` — replace the inline `generateSlug` function with an import:
  - Remove the local `async function generateSlug()` block
  - Add at top: `import { generateFormSlug } from '@/lib/slug'`
  - Change `const slug = await generateSlug()` → `const slug = await generateFormSlug()`

- [ ] Verify the dev server still starts: `bun run dev` (ctrl-c after it says Ready).

### Task 3: Add Doc models to Prisma schema

- [ ] Edit `prisma/schema.prisma` — add these two models at the end (before the closing):

```prisma
model Doc {
  id           String          @id @default(cuid())
  title        String
  content      String?
  ydocState    Bytes?
  orgId        String
  org          Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdById  String
  createdBy    User            @relation("DocCreator", fields: [createdById], references: [id])
  slug         String?         @unique
  publicAccess String?
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  permissions  DocPermission[]
}

model DocPermission {
  id     String @id @default(cuid())
  docId  String
  doc    Doc    @relation(fields: [docId], references: [id], onDelete: Cascade)
  userId String
  user   User   @relation("DocPermissionUser", fields: [userId], references: [id])
  role   String
  @@unique([docId, userId])
}
```

- [ ] Add back-relations to existing models in the schema:
  - On `Organization`: add `docs Doc[]`
  - On `User`: add `createdDocs Doc[] @relation("DocCreator")` and `docPermissions DocPermission[] @relation("DocPermissionUser")`

- [ ] Create migration manually (interactive `migrate dev` won't work in CI):
```bash
mkdir -p prisma/migrations/20260401000000_add_docs
cat > prisma/migrations/20260401000000_add_docs/migration.sql << 'EOF'
CREATE TABLE "Doc" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "ydocState" BYTEA,
  "orgId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "slug" TEXT,
  "publicAccess" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Doc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Doc_slug_key" ON "Doc"("slug");

CREATE TABLE "DocPermission" (
  "id" TEXT NOT NULL,
  "docId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  CONSTRAINT "DocPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocPermission_docId_userId_key" ON "DocPermission"("docId", "userId");

ALTER TABLE "Doc" ADD CONSTRAINT "Doc_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Doc" ADD CONSTRAINT "Doc_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "DocPermission" ADD CONSTRAINT "DocPermission_docId_fkey" FOREIGN KEY ("docId") REFERENCES "Doc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocPermission" ADD CONSTRAINT "DocPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE;
EOF
```

- [ ] Apply migration and regenerate client:
```bash
bunx prisma migrate deploy && bunx prisma generate
```
- [ ] Verify: `bunx prisma studio` shows Doc and DocPermission tables (ctrl-c after checking).

- [ ] Commit:
```bash
git add prisma/ src/lib/slug.ts src/app/api/boards/
git commit -m "feat: add Doc/DocPermission schema and slug utility"
```

---

## Chunk 2: Hocuspocus Server

### Task 4: Create server TypeScript config

- [ ] Create `server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist/server",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["server/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Task 5: Create Hocuspocus server

- [ ] Create `server/hocuspocus.ts`:
```typescript
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { createClient } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { verifySession } from '../src/lib/auth'

// Inline Prisma client for the server process
const connection = new createClient({ connectionString: process.env.DATABASE_URL })
connection.connect()
const adapter = new PrismaPg(connection)
const prisma = new PrismaClient({ adapter } as never)

function randomColor(): string {
  const colors = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6']
  return colors[Math.floor(Math.random() * colors.length)]
}

const server = Server.configure({
  port: Number(process.env.HOCUSPOCUS_PORT ?? 1234),

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await prisma.doc.findUnique({ where: { id: documentName } })
        return doc?.ydocState ? Buffer.from(doc.ydocState) : null
      },
      store: async ({ documentName, state }) => {
        await prisma.doc.update({
          where: { id: documentName },
          data: { ydocState: Buffer.from(state), updatedAt: new Date() },
        })
      },
    }),
  ],

  async onAuthenticate({ token, documentName }) {
    // Public edit access: token = "public:<slug>"
    if (token.startsWith('public:')) {
      const slug = token.slice(7)
      const doc = await prisma.doc.findUnique({ where: { slug } })
      if (!doc || doc.id !== documentName || doc.publicAccess !== 'edit') {
        throw new Error('Forbidden')
      }
      return { userId: null, name: `Guest ${Math.floor(Math.random() * 9000) + 1000}`, color: randomColor() }
    }

    // Authenticated user
    const session = await verifySession(token)
    if (!session) throw new Error('Unauthorized')

    const doc = await prisma.doc.findUnique({ where: { id: documentName } })
    if (!doc) throw new Error('Not found')

    // Owner always has access
    if (doc.createdById === session.sub) {
      const user = await prisma.user.findUnique({ where: { id: session.sub } })
      return { userId: session.sub, name: user?.name ?? 'Unknown', color: randomColor() }
    }

    // Check explicit permission
    const perm = await prisma.docPermission.findUnique({
      where: { docId_userId: { docId: doc.id, userId: session.sub } },
    })
    if (!perm) throw new Error('Forbidden')

    const user = await prisma.user.findUnique({ where: { id: session.sub } })
    return { userId: session.sub, name: user?.name ?? 'Unknown', color: randomColor(), readOnly: perm.role === 'viewer' }
  },
})

server.listen().then(() => {
  console.log(`Hocuspocus server running on port ${process.env.HOCUSPOCUS_PORT ?? 1234}`)
})
```

### Task 6: Update Makefile

- [ ] Edit `Makefile` — replace the `dev` target:
```makefile
dev:
	env -u REMOTE_API_URL concurrently \
	  "bun run dev" \
	  "npx ts-node --project server/tsconfig.json server/hocuspocus.ts"
```
- [ ] Install concurrently: `bun add -d concurrently`
- [ ] Add `NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` to `.env.local` (and `.env.local.example`).
- [ ] Test: `make dev` — both processes should start. Ctrl-C to stop.

- [ ] Commit:
```bash
git add server/ Makefile .env.local.example package.json bun.lock
git commit -m "feat: add Hocuspocus WebSocket server for doc collaboration"
```

---

## Chunk 3: API Routes

### Task 7: Update proxy PUBLIC_PATHS

- [ ] Edit `src/proxy.ts` line 6 — add `/d/` and `/api/docs/` to the array:
```typescript
const PUBLIC_PATHS = ['/login', '/oauth/callback', '/api/auth/login', '/api/auth/callback', '/api/auth/logout', '/api/auth/oauth-token', '/invite/', '/api/invites/', '/forms/', '/api/forms/', '/f/', '/d/', '/api/docs/']
```

### Task 8: Docs list + create API

- [ ] Create `src/app/api/orgs/[orgId]/docs/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDocSlug } from '@/lib/slug'

type Params = { params: Promise<{ orgId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const docs = await prisma.doc.findMany({
    where: {
      orgId,
      OR: [
        { createdById: userId },
        { permissions: { some: { userId } } },
      ],
    },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { permissions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return NextResponse.json(docs)
}

export async function POST(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  const { title } = await request.json()
  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const doc = await prisma.doc.create({
    data: { title: title.trim(), orgId, createdById: userId },
    include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(doc, { status: 201 })
}
```

### Task 9: Doc CRUD API

- [ ] Create `src/app/api/orgs/[orgId]/docs/[docId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDocSlug } from '@/lib/slug'

type Params = { params: Promise<{ orgId: string; docId: string }> }

async function getDocAndCheckAccess(docId: string, userId: string) {
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      permissions: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })
  if (!doc) return null
  if (doc.createdById === userId) return { doc, role: 'owner' as const }
  const perm = doc.permissions.find((p) => p.userId === userId)
  if (!perm) return null
  return { doc, role: perm.role as 'viewer' | 'editor' }
}

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const result = await getDocAndCheckAccess(docId, userId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...result.doc, myRole: result.role })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const result = await getDocAndCheckAccess(docId, userId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // Handle public link slug generation
  let slug = undefined as string | null | undefined
  if (body.publicAccess !== undefined) {
    if (!body.publicAccess) {
      slug = null // removing public access clears slug too
    } else if (!result.doc.slug) {
      slug = await generateDocSlug()
    }
  }

  const doc = await prisma.doc.update({
    where: { id: docId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.publicAccess !== undefined && { publicAccess: body.publicAccess || null }),
      ...(slug !== undefined && { slug }),
    },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      permissions: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  })
  return NextResponse.json({ ...doc, myRole: 'owner' })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const result = await getDocAndCheckAccess(docId, userId)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (result.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await prisma.doc.delete({ where: { id: docId } })
  return new NextResponse(null, { status: 204 })
}
```

### Task 10: Permissions API

- [ ] Create `src/app/api/orgs/[orgId]/docs/[docId]/permissions/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ orgId: string; docId: string }> }

async function assertOwner(docId: string, userId: string) {
  const doc = await prisma.doc.findUnique({ where: { id: docId } })
  if (!doc) return null
  if (doc.createdById !== userId) return null
  return doc
}

export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const doc = await prisma.doc.findUnique({ where: { id: docId }, include: { permissions: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (doc.createdById !== userId) {
    const perm = doc.permissions.find(p => p.userId === userId)
    if (!perm) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(doc.permissions)
}

export async function POST(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const doc = await assertOwner(docId, userId)
  if (!doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targetUserId, role } = await request.json()
  if (!targetUserId || !['viewer', 'editor'].includes(role)) {
    return NextResponse.json({ error: 'targetUserId and role (viewer|editor) required' }, { status: 400 })
  }
  const perm = await prisma.docPermission.upsert({
    where: { docId_userId: { docId, userId: targetUserId } },
    create: { docId, userId: targetUserId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(perm, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { docId } = await params
  const doc = await assertOwner(docId, userId)
  if (!doc) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { targetUserId } = await request.json()
  await prisma.docPermission.deleteMany({ where: { docId, userId: targetUserId } })
  return new NextResponse(null, { status: 204 })
}
```

### Task 11: Public doc API

- [ ] Create `src/app/api/docs/[docId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const doc = await prisma.doc.findUnique({
    where: { id: docId },
    select: { id: true, title: true, content: true, publicAccess: true, slug: true },
  })
  if (!doc || !doc.publicAccess) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(doc)
}
```

- [ ] Commit:
```bash
git add src/proxy.ts src/app/api/orgs/ src/app/api/docs/
git commit -m "feat: add docs API routes (CRUD, permissions, public)"
```

---

## Chunk 4: DocEditor Component

### Task 12: Create DocEditor component

- [ ] Create `src/components/docs/DocEditor.tsx`:
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/core'
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
  token: string          // JWT cookie value or "public:<slug>"
  readOnly?: boolean
  hocuspocusUrl: string  // process.env.NEXT_PUBLIC_HOCUSPOCUS_URL
}

function Toolbar({ editor, onImagePaste }: { editor: Editor; onImagePaste: () => void }) {
  return (
    <div className="flex items-center gap-0.5 border-b px-3 py-1.5 flex-wrap shrink-0">
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleBold().run()} data-active={editor.isActive('bold')}>
        <Bold size={13} />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleItalic().run()} data-active={editor.isActive('italic')}>
        <Italic size={13} />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} data-active={editor.isActive('heading', { level: 1 })}>
        <Heading1 size={13} />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} data-active={editor.isActive('heading', { level: 2 })}>
        <Heading2 size={13} />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleBulletList().run()} data-active={editor.isActive('bulletList')}>
        <List size={13} />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleOrderedList().run()} data-active={editor.isActive('orderedList')}>
        <ListOrdered size={13} />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => editor.chain().focus().toggleCode().run()} data-active={editor.isActive('code')}>
        <Code size={13} />
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onImagePaste} title="Insert image">
        <ImageIcon size={13} />
      </Button>
    </div>
  )
}

export default function DocEditor({ docId, token, readOnly = false, hocuspocusUrl }: DocEditorProps) {
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const [connected, setConnected] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [markdownText, setMarkdownText] = useState('')

  // Init Yjs + Hocuspocus
  useEffect(() => {
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const provider = new HocuspocusProvider({
      url: hocuspocusUrl,
      name: docId,
      document: ydoc,
      token,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
    })
    providerRef.current = provider

    return () => {
      provider.destroy()
      ydoc.destroy()
    }
  }, [docId, token, hocuspocusUrl])

  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ history: false }),
      ...(ydocRef.current ? [
        Collaboration.configure({ document: ydocRef.current }),
        CollaborationCursor.configure({
          provider: providerRef.current!,
        }),
      ] : []),
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

  // Handle paste events for images
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
    dom.addEventListener('paste', handler as EventListener)
    return () => dom.removeEventListener('paste', handler as EventListener)
  }, [editor])

  if (!editor) return <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading editor…</div>

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {!readOnly && <Toolbar editor={editor} onImagePaste={() => imageInputRef.current?.click()} />}
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
      <div className="flex items-center gap-2 px-3 py-1 border-b text-xs text-muted-foreground">
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
          className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-full"
        />
      )}
    </div>
  )
}
```

- [ ] Install Hocuspocus provider package: `bun add @hocuspocus/provider`
- [ ] Verify TypeScript compiles: `bunx tsc --noEmit`

- [ ] Commit:
```bash
git add src/components/docs/
git commit -m "feat: add DocEditor component with Tiptap + Yjs collaboration"
```

---

## Chunk 5: Pages

### Task 13: Doc list page

- [ ] Create `src/app/orgs/[orgId]/docs/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Plus, FileText, Search } from 'lucide-react'

interface Doc {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  publicAccess: string | null
  createdBy: { id: string; name: string; avatarUrl: string | null }
  _count: { permissions: number }
}

export default function DocsPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const router = useRouter()
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/docs`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [orgId])

  async function createDoc() {
    setCreating(true)
    try {
      const res = await fetch(`/api/orgs/${orgId}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled' }),
      })
      if (!res.ok) throw new Error('Failed')
      const doc = await res.json()
      router.push(`/orgs/${orgId}/docs/${doc.id}`)
    } catch {
      toast.error('Failed to create doc')
      setCreating(false)
    }
  }

  const filtered = docs.filter((d) => d.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
          <h1 className="text-lg font-semibold flex-1">Docs</h1>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-8 w-48" />
          </div>
          <Button size="sm" onClick={createDoc} disabled={creating}>
            <Plus size={13} className="mr-1" />New doc
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-20 text-muted-foreground">
              <FileText size={32} className="opacity-30" />
              <p className="text-sm">{docs.length === 0 ? 'No docs yet. Create one to get started.' : 'No results.'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-w-2xl">
              {filtered.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => router.push(`/orgs/${orgId}/docs/${doc.id}`)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                >
                  <FileText size={16} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                      {doc.publicAccess && <span className="ml-2 text-green-600">• Public</span>}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
```

### Task 14: Doc editor page

- [ ] Create `src/app/orgs/[orgId]/docs/[docId]/page.tsx`:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ArrowLeft, Settings, Copy, Check, Trash2, Users } from 'lucide-react'
import { COOKIE_NAME } from '@/lib/auth'

const DocEditor = dynamic(() => import('@/components/docs/DocEditor'), { ssr: false })

interface DocData {
  id: string
  title: string
  content: string | null
  slug: string | null
  publicAccess: string | null
  myRole: 'owner' | 'editor' | 'viewer'
  createdBy: { id: string; name: string }
  permissions: Array<{ id: string; role: string; user: { id: string; name: string; avatarUrl: string | null } }>
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : ''
}

export default function DocEditorPage() {
  const { orgId, docId } = useParams<{ orgId: string; docId: string }>()
  const router = useRouter()
  const [doc, setDoc] = useState<DocData | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const [copied, setCopied] = useState(false)
  const [token, setToken] = useState('')

  useEffect(() => {
    setToken(getCookie(COOKIE_NAME))
    fetch(`/api/orgs/${orgId}/docs/${docId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) { setDoc(d); setTitle(d.title) }
      })
      .finally(() => setLoading(false))
  }, [orgId, docId])

  async function saveTitle() {
    if (!doc || title === doc.title) return
    const res = await fetch(`/api/orgs/${orgId}/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (res.ok) setDoc((d) => d ? { ...d, title } : d)
  }

  async function setPublicAccess(access: string | null) {
    const res = await fetch(`/api/orgs/${orgId}/docs/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicAccess: access }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDoc(updated)
    }
  }

  async function deleteDoc() {
    if (!confirm('Delete this doc?')) return
    await fetch(`/api/orgs/${orgId}/docs/${docId}`, { method: 'DELETE' })
    router.push(`/orgs/${orgId}/docs`)
  }

  function copyPublicLink() {
    if (!doc?.slug) return
    navigator.clipboard.writeText(`${window.location.origin}/d/${doc.slug}`)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const isOwner = doc?.myRole === 'owner'
  const canEdit = doc?.myRole === 'owner' || doc?.myRole === 'editor'
  const hocuspocusUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ?? 'ws://localhost:1234'

  if (loading) return <AppShell><div className="p-6 text-muted-foreground text-sm">Loading…</div></AppShell>
  if (!doc) return <AppShell><div className="p-6 text-muted-foreground text-sm">Doc not found</div></AppShell>

  return (
    <AppShell>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/orgs/${orgId}/docs`)}>
            <ArrowLeft size={15} />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            disabled={!isOwner}
            className="flex-1 h-8 text-base font-semibold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent"
          />
          {isOwner && (
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowSidebar((v) => !v)}>
              <Settings size={15} />
            </Button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {token && (
              <DocEditor
                docId={docId}
                token={token}
                readOnly={!canEdit}
                hocuspocusUrl={hocuspocusUrl}
              />
            )}
          </div>

          {/* Settings sidebar */}
          {showSidebar && isOwner && (
            <div className="w-60 shrink-0 border-l overflow-y-auto p-4 flex flex-col gap-5 bg-muted/10">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Public Access</p>
                {(['', 'read', 'edit'] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="publicAccess"
                      checked={(doc.publicAccess ?? '') === val}
                      onChange={() => setPublicAccess(val || null)}
                    />
                    {val === '' ? 'Private' : val === 'read' ? 'Public (read-only)' : 'Public (editable)'}
                  </label>
                ))}
                {doc.slug && (
                  <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 bg-muted/30 mt-1">
                    <code className="text-xs flex-1 truncate text-muted-foreground">/d/{doc.slug}</code>
                    <button onClick={copyPublicLink} className="shrink-0 text-muted-foreground hover:text-foreground">
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Users size={11} /> Members ({doc.permissions.length})
                </p>
                {doc.permissions.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{p.user.name}</span>
                    <span className="text-xs text-muted-foreground">{p.role}</span>
                  </div>
                ))}
              </div>

              <Button variant="destructive" size="sm" onClick={deleteDoc} className="mt-auto">
                <Trash2 size={13} className="mr-1" />Delete doc
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
```

### Task 15: Public doc page

- [ ] Create `src/app/d/[slug]/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PublicDocView from './PublicDocView'

export default async function PublicDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = await prisma.doc.findUnique({
    where: { slug },
    select: { id: true, title: true, content: true, publicAccess: true },
  })
  if (!doc || !doc.publicAccess) redirect('/404')
  return <PublicDocView doc={doc} slug={slug} />
}
```

- [ ] Create `src/app/d/[slug]/PublicDocView.tsx`:
```tsx
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
```

### Task 16: Add Docs nav link

- [ ] Edit `src/components/shared/AppShell.tsx` — add a Docs nav item after the Files entry:
  - Add `BookOpen` to the lucide-react import
  - Add to `navItems` array after the files entry:
  ```tsx
  {
    href: activeOrg ? `/orgs/${activeOrg.id}/docs` : '#',
    icon: BookOpen,
    label: 'Docs',
    show: !loading && !!activeOrg,
  },
  ```

- [ ] Commit:
```bash
git add src/app/orgs/ src/app/d/ src/components/shared/AppShell.tsx
git commit -m "feat: add docs pages (list, editor, public) and nav link"
```

---

## Chunk 6: Final Wiring & Verification

### Task 17: End-to-end verification

- [ ] Start dev servers: `make dev` — confirm both Next.js and Hocuspocus start without errors.
- [ ] In browser, navigate to `/orgs/<orgId>/docs` — Docs link visible in sidebar.
- [ ] Create a new doc — navigates to editor, Tiptap loads, "Live" indicator appears.
- [ ] Open same doc in a second tab — type in one, see text appear in the other. Cursor label visible.
- [ ] Click Settings (⚙) → set Public Access to "read" → `/d/<slug>` opens in incognito as read-only.
- [ ] Set Public Access to "edit" → incognito user can type, shows "Guest XXXX" cursor in first tab.
- [ ] Toggle Markdown source → raw text visible → edit → toggle back → content reflects edits.
- [ ] Paste image → uploads via `/api/upload` → embedded in doc.
- [ ] Delete doc → redirects to list.

### Task 18: acp

- [ ] Run `/acp` to add, commit, and push all remaining changes.
