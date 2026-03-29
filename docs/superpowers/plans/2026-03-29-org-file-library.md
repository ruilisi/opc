# Org File Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an org-level shared file library where all org members can upload, organize (folders + tags), preview, and share documents — stored on Qiniu, tracked in PostgreSQL, synced in realtime via SSE.

**Architecture:** New Prisma models (`OrgFolder`, `OrgFile`, `OrgFileTag`, `OrgFileTagAssignment`) + REST API routes under `/api/orgs/[orgId]/` + SSE endpoint at `/api/orgs/[orgId]/file-events` + React page at `/orgs/[orgId]/files` with three-panel layout (folder tree / file list / preview modal). Realtime uses the existing in-process EventEmitter pattern from `src/lib/realtime.ts`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, Qiniu SDK, SSE (native), TypeScript, Tailwind v4, shadcn/ui, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-29-org-file-library-design.md`

---

## File Map

### New files
| Path | Responsibility |
|---|---|
| `src/lib/hooks/useOrgFileSubscription.ts` | SSE client hook for org file events |
| `src/app/api/orgs/[orgId]/files/route.ts` | GET list + POST upload |
| `src/app/api/orgs/[orgId]/files/[fileId]/route.ts` | PATCH rename/move + DELETE |
| `src/app/api/orgs/[orgId]/files/[fileId]/tags/[tagId]/route.ts` | POST/DELETE tag assignment |
| `src/app/api/orgs/[orgId]/folders/route.ts` | GET tree + POST create |
| `src/app/api/orgs/[orgId]/folders/[folderId]/route.ts` | PATCH rename/reparent + DELETE cascade |
| `src/app/api/orgs/[orgId]/file-tags/route.ts` | GET list + POST create |
| `src/app/api/orgs/[orgId]/file-tags/[tagId]/route.ts` | PATCH update + DELETE |
| `src/app/api/orgs/[orgId]/file-events/route.ts` | SSE stream |
| `src/components/files/FileIcon.tsx` | Icon by MIME type |
| `src/components/files/FileContextMenu.tsx` | Right-click context menu |
| `src/components/files/FolderTree.tsx` | Left-panel collapsible tree |
| `src/components/files/FileList.tsx` | Sortable file table |
| `src/components/files/FilePreviewModal.tsx` | Left-click preview (PDF/image/video/audio/text/fallback) |
| `src/components/files/TagFilterBar.tsx` | Tag chip filter row |
| `src/components/files/UploadArea.tsx` | Upload button + drag-drop zone |
| `src/app/orgs/[orgId]/files/page.tsx` | Main library page |

### Modified files
| Path | Change |
|---|---|
| `prisma/schema.prisma` | Add OrgFolder, OrgFile, OrgFileTag, OrgFileTagAssignment; extend Organization + User back-relations |
| `src/lib/realtime.ts` | Add `emitOrgFileEvent` + `subscribeOrgFileEvents` |
| `src/lib/qiniu.ts` | Add `deleteFromQiniu(key)` helper |
| `src/types/index.ts` | Add OrgFile, OrgFolder, OrgFileTag, OrgFileEvent types |
| `src/lib/i18n.tsx` | Add file library translation keys (en + zh) |
| `src/components/shared/AppShell.tsx` | Add "文件库" nav item |

---

## Chunk 1: Foundation — Schema, Realtime, Qiniu, Types, i18n

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and back-relations to schema.prisma**

Add after the `OrgInvite` model (before `Board`):

```prisma
model OrgFolder {
  id          String       @id @default(cuid())
  name        String
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  parentId    String?
  parent      OrgFolder?   @relation("FolderTree", fields: [parentId], references: [id], onDelete: SetNull)
  children    OrgFolder[]  @relation("FolderTree")
  files       OrgFile[]
  createdById String
  createdBy   User         @relation("FolderCreator", fields: [createdById], references: [id])
  createdAt   DateTime     @default(now())
}

model OrgFile {
  id         String                 @id @default(cuid())
  name       String
  url        String
  key        String
  size       Int
  mimeType   String
  orgId      String
  org        Organization           @relation(fields: [orgId], references: [id], onDelete: Cascade)
  folderId   String?
  folder     OrgFolder?             @relation(fields: [folderId], references: [id], onDelete: SetNull)
  uploaderId String
  uploader   User                   @relation("FileUploader", fields: [uploaderId], references: [id])
  tags       OrgFileTagAssignment[]
  createdAt  DateTime               @default(now())
  updatedAt  DateTime               @updatedAt
}

model OrgFileTag {
  id        String                 @id @default(cuid())
  name      String
  color     String                 @default("#6366f1")
  orgId     String
  org       Organization           @relation(fields: [orgId], references: [id], onDelete: Cascade)
  files     OrgFileTagAssignment[]
  createdAt DateTime               @default(now())
}

model OrgFileTagAssignment {
  fileId String
  tagId  String
  file   OrgFile    @relation(fields: [fileId], references: [id], onDelete: Cascade)
  tag    OrgFileTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([fileId, tagId])
}
```

Add back-relations to `Organization` (after `sentryOrgs SentryOrg[]`):
```prisma
  folders  OrgFolder[]
  files    OrgFile[]
  fileTags OrgFileTag[]
```

Add back-relations to `User` (after `orgMembers OrgMember[]`):
```prisma
  uploadedFiles  OrgFile[]   @relation("FileUploader")
  createdFolders OrgFolder[] @relation("FolderCreator")
```

- [ ] **Step 2: Run migration**

```bash
bunx prisma migrate dev --name add_org_file_library
```

Expected: Migration created and applied. `bunx prisma generate` runs automatically.

- [ ] **Step 3: Verify generated client compiles**

```bash
bunx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/ src/generated/
git commit -m "feat(db): add OrgFolder, OrgFile, OrgFileTag models"
```

---

### Task 2: Extend realtime.ts with org-file channels

**Files:**
- Modify: `src/lib/realtime.ts`

- [ ] **Step 1: Add org-file event types and functions**

Append to `src/lib/realtime.ts`:

```ts
export interface OrgFileEvent {
  type:
    | 'file.uploaded'
    | 'file.renamed'
    | 'file.moved'
    | 'file.deleted'
    | 'file.tag_added'
    | 'file.tag_removed'
    | 'folder.created'
    | 'folder.renamed'
    | 'folder.deleted'
    | 'tag.created'
    | 'tag.updated'
    | 'tag.deleted'
  payload: object
}

export function emitOrgFileEvent(orgId: string, event: OrgFileEvent) {
  emitter.emit(`org-files:${orgId}`, event)
}

export function subscribeOrgFileEvents(
  orgId: string,
  handler: (event: OrgFileEvent) => void
): () => void {
  emitter.on(`org-files:${orgId}`, handler)
  return () => emitter.off(`org-files:${orgId}`, handler)
}
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/realtime.ts
git commit -m "feat(realtime): add org-file event channel"
```

---

### Task 3: Add deleteFromQiniu helper

**Files:**
- Modify: `src/lib/qiniu.ts`

- [ ] **Step 1: Append deleteFromQiniu function**

Add to the end of `src/lib/qiniu.ts`:

```ts
export async function deleteFromQiniu(key: string): Promise<void> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'qiniu' } })
  const cfg = setting ? JSON.parse(setting.value) : {}

  const accessKey = cfg.accessKey || process.env.QINIU_ACCESS_KEY || ''
  const secretKey = cfg.secretKey || process.env.QINIU_SECRET_KEY || ''
  const bucket    = cfg.bucket    || process.env.QINIU_BUCKET      || ''

  if (!accessKey || !secretKey || !bucket) return

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const config = new qiniu.conf.Config()
  const bucketManager = new qiniu.rs.BucketManager(mac, config)

  await new Promise<void>((resolve, reject) => {
    bucketManager.delete(bucket, key, (err, _body, info) => {
      if (err || (info.statusCode !== 200 && info.statusCode !== 612)) {
        // 612 = object not found (already deleted), treat as success
        reject(err ?? new Error(`Qiniu delete failed: ${info.statusCode}`))
      } else {
        resolve()
      }
    })
  })
}
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/qiniu.ts
git commit -m "feat(qiniu): add deleteFromQiniu helper"
```

---

### Task 4: Add types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add OrgFile-related types to src/types/index.ts**

Append to the file:

```ts
export interface OrgFileTag {
  id: string
  name: string
  color: string
  orgId: string
  createdAt: string
}

export interface OrgFolder {
  id: string
  name: string
  orgId: string
  parentId: string | null
  createdById: string
  createdAt: string
  children?: OrgFolder[]
}

export interface OrgFileUploader {
  id: string
  name: string
  avatarUrl?: string | null
}

export interface OrgFile {
  id: string
  name: string
  url: string
  key: string
  size: number
  mimeType: string
  orgId: string
  folderId: string | null
  uploaderId: string
  uploader: OrgFileUploader
  tags: Array<{ tag: OrgFileTag }>
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add OrgFile, OrgFolder, OrgFileTag types"
```

---

### Task 5: Add i18n translation keys

**Files:**
- Modify: `src/lib/i18n.tsx`

- [ ] **Step 1: Add keys to both `en` and `zh` translation objects in src/lib/i18n.tsx**

In the `en` object, add (e.g. after `nav_join`):
```ts
// File library
nav_files: 'File Library',
files_title: 'File Library',
files_upload: 'Upload',
files_uploading: 'Uploading...',
files_upload_error: 'Upload failed',
files_no_qiniu: 'Configure Qiniu storage in Settings first',
files_empty: 'No files yet',
files_search_ph: 'Search files...',
files_sort_name: 'Name',
files_sort_size: 'Size',
files_sort_date: 'Date',
files_col_name: 'Name',
files_col_size: 'Size',
files_col_uploader: 'Uploader',
files_col_date: 'Date',
files_ctx_copy_link: 'Copy link',
files_ctx_rename: 'Rename',
files_ctx_move: 'Move to folder',
files_ctx_tags: 'Add / remove tags',
files_ctx_download: 'Download',
files_ctx_delete: 'Delete',
files_rename_ph: 'File name',
files_rename_submit: 'Rename',
files_delete_confirm: 'Delete this file permanently?',
files_delete_ok: 'Delete',
files_delete_cancel: 'Cancel',
files_too_large: 'File cannot exceed 100 MB',
files_no_preview: 'No preview available for this file type.',
files_download_instead: 'Download',
files_preview_title: 'Preview',
// Folders
folders_root: 'Root',
folders_new: 'New folder',
folders_new_ph: 'Folder name',
folders_new_submit: 'Create',
folders_rename: 'Rename folder',
folders_rename_ph: 'Folder name',
folders_rename_submit: 'Rename',
folders_delete: 'Delete folder',
folders_delete_warning: 'Files inside will be moved to root, not deleted.',
folders_delete_ok: 'Delete folder',
// Tags
tags_title: 'Tags',
tags_new: 'New tag',
tags_new_ph: 'Tag name',
tags_new_submit: 'Create',
tags_delete_confirm: 'Delete this tag?',
```

In the `zh` object, add the same keys with Chinese values:
```ts
// File library
nav_files: '文件库',
files_title: '文件库',
files_upload: '上传文件',
files_uploading: '上传中...',
files_upload_error: '上传失败',
files_no_qiniu: '请先在设置中配置 Qiniu 存储',
files_empty: '暂无文件',
files_search_ph: '搜索文件...',
files_sort_name: '名称',
files_sort_size: '大小',
files_sort_date: '日期',
files_col_name: '名称',
files_col_size: '大小',
files_col_uploader: '上传者',
files_col_date: '上传时间',
files_ctx_copy_link: '复制链接',
files_ctx_rename: '重命名',
files_ctx_move: '移动到文件夹',
files_ctx_tags: '添加/移除标签',
files_ctx_download: '下载',
files_ctx_delete: '删除',
files_rename_ph: '文件名',
files_rename_submit: '重命名',
files_delete_confirm: '永久删除此文件？',
files_delete_ok: '删除',
files_delete_cancel: '取消',
files_too_large: '文件不能超过 100 MB',
files_no_preview: '该格式暂不支持预览',
files_download_instead: '下载',
files_preview_title: '预览',
// Folders
folders_root: '根目录',
folders_new: '新建文件夹',
folders_new_ph: '文件夹名称',
folders_new_submit: '创建',
folders_rename: '重命名文件夹',
folders_rename_ph: '文件夹名称',
folders_rename_submit: '重命名',
folders_delete: '删除文件夹',
folders_delete_warning: '文件夹内的文件将移至根目录，不会被删除。',
folders_delete_ok: '删除文件夹',
// Tags
tags_title: '标签',
tags_new: '新建标签',
tags_new_ph: '标签名称',
tags_new_submit: '创建',
tags_delete_confirm: '删除此标签？',
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n.tsx
git commit -m "feat(i18n): add file library translation keys"
```

---

### Task 6: Add nav item to AppShell

**Files:**
- Modify: `src/components/shared/AppShell.tsx`

- [ ] **Step 1: Add FolderOpen icon import and nav item**

In the import line that includes `Heart`, add `FolderOpen`:
```ts
import { LayoutDashboard, Settings, Bug, Building2, Sun, Moon, Monitor, Languages, Heart, FolderOpen } from 'lucide-react'
```

In the `navItems` array, add after the Sentry item:
```ts
{
  href: activeOrg ? `/orgs/${activeOrg.id}/files` : '#',
  icon: FolderOpen,
  label: t('nav_files'),
  show: !loading && !!activeOrg,
},
```

- [ ] **Step 2: Verify it compiles**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/AppShell.tsx
git commit -m "feat(nav): add file library nav item"
```

---

## Chunk 2: API Routes

### Task 7: Files list + upload — GET/POST /api/orgs/[orgId]/files

**Files:**
- Create: `src/app/api/orgs/[orgId]/files/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadToQiniu } from '@/lib/qiniu'
import { emitOrgFileEvent } from '@/lib/realtime'

const FILE_SIZE_LIMIT = 100 * 1024 * 1024 // 100 MB

const fileInclude = {
  uploader: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: true } },
} as const

async function getMembership(orgId: string, userId: string) {
  return prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await getMembership(orgId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const folderId = searchParams.get('folderId')
  const search = searchParams.get('search')
  const tagIds = searchParams.getAll('tagId')
  const sort = (searchParams.get('sort') ?? 'createdAt') as 'name' | 'size' | 'createdAt'
  const order = (searchParams.get('order') ?? 'desc') as 'asc' | 'desc'

  const where: Record<string, unknown> = { orgId }
  if (folderId && folderId !== 'all') where.folderId = folderId === 'root' ? null : folderId
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (tagIds.length > 0) {
    where.tags = { some: { tagId: { in: tagIds } } }
    // AND: all tags must be present — filter post-query
  }

  let files = await prisma.orgFile.findMany({
    where,
    include: fileInclude,
    orderBy: { [sort]: order },
  })

  // AND filter for multiple tags
  if (tagIds.length > 1) {
    files = files.filter((f) =>
      tagIds.every((tid) => f.tags.some((t) => t.tagId === tid))
    )
  }

  return NextResponse.json({ files })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await getMembership(orgId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (member.role === 'viewer') return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.size > FILE_SIZE_LIMIT) return NextResponse.json({ error: 'File too large', code: 'FILE_TOO_LARGE' }, { status: 413 })

  const folderIdRaw = formData.get('folderId') as string | null
  const folderId = folderIdRaw || null

  // Validate folder belongs to org
  if (folderId) {
    const folder = await prisma.orgFolder.findUnique({ where: { id: folderId }, select: { orgId: true } })
    if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let uploadResult: { url: string; key: string }
  try {
    uploadResult = await uploadToQiniu(buffer, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const code = message.includes('not configured') ? 'STORAGE_UNCONFIGURED' : 'UPLOAD_FAILED'
    return NextResponse.json({ error: message, code }, { status: 503 })
  }

  const orgFile = await prisma.orgFile.create({
    data: {
      name: file.name,
      url: uploadResult.url,
      key: uploadResult.key,
      size: file.size,
      mimeType: file.type.toLowerCase() || 'application/octet-stream',
      orgId,
      folderId,
      uploaderId: userId,
    },
    include: fileInclude,
  })

  emitOrgFileEvent(orgId, { type: 'file.uploaded', payload: orgFile })
  return NextResponse.json(orgFile, { status: 201 })
}
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orgs/
git commit -m "feat(api): add GET/POST /api/orgs/[orgId]/files"
```

---

### Task 8: File rename/move/delete — PATCH/DELETE /api/orgs/[orgId]/files/[fileId]

**Files:**
- Create: `src/app/api/orgs/[orgId]/files/[fileId]/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteFromQiniu } from '@/lib/qiniu'
import { emitOrgFileEvent } from '@/lib/realtime'

const fileInclude = {
  uploader: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: true } },
} as const

async function getFileAndMember(orgId: string, fileId: string, userId: string) {
  const [file, member] = await Promise.all([
    prisma.orgFile.findUnique({ where: { id: fileId }, include: fileInclude }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  return { file, member }
}

function canEdit(member: { role: string } | null, file: { uploaderId: string } | null, userId: string) {
  if (!member || !file) return false
  if (member.role === 'viewer') return false
  if (member.role === 'admin' || member.role === 'owner') return true
  return file.uploaderId === userId
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId } = await params

  const { file, member } = await getFileAndMember(orgId, fileId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (!file || file.orgId !== orgId) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canEdit(member, file, userId)) return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  const body = await request.json()
  const { name, folderId } = body

  if (folderId !== undefined && folderId !== null) {
    const folder = await prisma.orgFolder.findUnique({ where: { id: folderId }, select: { orgId: true } })
    if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const updated = await prisma.orgFile.update({
    where: { id: fileId },
    data: {
      ...(name !== undefined && { name }),
      ...(folderId !== undefined && { folderId: folderId ?? null }),
    },
    include: fileInclude,
  })

  if (name !== undefined) emitOrgFileEvent(orgId, { type: 'file.renamed', payload: { fileId, name } })
  if (folderId !== undefined) emitOrgFileEvent(orgId, { type: 'file.moved', payload: { fileId, folderId: folderId ?? null } })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId } = await params

  const { file, member } = await getFileAndMember(orgId, fileId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (!file || file.orgId !== orgId) return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canEdit(member, file, userId)) return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  await prisma.orgFile.delete({ where: { id: fileId } })

  // Delete from Qiniu — log errors but don't roll back
  try {
    await deleteFromQiniu(file.key)
  } catch (err) {
    console.error(`[qiniu] Failed to delete key ${file.key}:`, err)
  }

  emitOrgFileEvent(orgId, { type: 'file.deleted', payload: { fileId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify types compile**

```bash
bunx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orgs/
git commit -m "feat(api): add PATCH/DELETE /api/orgs/[orgId]/files/[fileId]"
```

---

### Task 9: Tag assignments — POST/DELETE /api/orgs/[orgId]/files/[fileId]/tags/[tagId]

**Files:**
- Create: `src/app/api/orgs/[orgId]/files/[fileId]/tags/[tagId]/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

async function checkAccess(orgId: string, fileId: string, userId: string) {
  const [file, member] = await Promise.all([
    prisma.orgFile.findUnique({ where: { id: fileId }, select: { orgId: true, uploaderId: true } }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  if (!member || !file || file.orgId !== orgId) return null
  if (member.role === 'viewer') return null
  if (member.role === 'admin' || member.role === 'owner') return { file, member }
  if (file.uploaderId !== userId) return null
  return { file, member }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId, tagId } = await params

  const access = await checkAccess(orgId, fileId, userId)
  if (!access) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const tag = await prisma.orgFileTag.findUnique({ where: { id: tagId }, select: { id: true, name: true, color: true, orgId: true } })
  if (!tag || tag.orgId !== orgId) return NextResponse.json({ error: 'Tag not found' }, { status: 404 })

  await prisma.orgFileTagAssignment.upsert({
    where: { fileId_tagId: { fileId, tagId } },
    create: { fileId, tagId },
    update: {},
  })

  emitOrgFileEvent(orgId, { type: 'file.tag_added', payload: { fileId, tag } })
  return NextResponse.json({ tag })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; fileId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, fileId, tagId } = await params

  const access = await checkAccess(orgId, fileId, userId)
  if (!access) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  await prisma.orgFileTagAssignment.deleteMany({ where: { fileId, tagId } })

  emitOrgFileEvent(orgId, { type: 'file.tag_removed', payload: { fileId, tagId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify types compile + commit**

```bash
bunx tsc --noEmit
git add src/app/api/orgs/
git commit -m "feat(api): add tag assignment endpoints"
```

---

### Task 10: Folders — GET tree, POST create, PATCH, DELETE

**Files:**
- Create: `src/app/api/orgs/[orgId]/folders/route.ts`
- Create: `src/app/api/orgs/[orgId]/folders/[folderId]/route.ts`

- [ ] **Step 1: Create folders/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const folders = await prisma.orgFolder.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, parentId: true, createdById: true, createdAt: true, orgId: true },
  })
  return NextResponse.json(folders)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role === 'viewer') return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  const { name, parentId } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  if (parentId) {
    const parent = await prisma.orgFolder.findUnique({ where: { id: parentId }, select: { orgId: true } })
    if (!parent || parent.orgId !== orgId) return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
  }

  const folder = await prisma.orgFolder.create({
    data: { name: name.trim(), orgId, parentId: parentId ?? null, createdById: userId },
    select: { id: true, name: true, parentId: true, createdById: true, createdAt: true, orgId: true },
  })

  emitOrgFileEvent(orgId, { type: 'folder.created', payload: folder })
  return NextResponse.json(folder, { status: 201 })
}
```

- [ ] **Step 2: Create folders/[folderId]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

function canEditFolder(role: string, createdById: string, userId: string) {
  if (role === 'viewer' || role === 'member') return createdById === userId
  return true // admin or owner
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; folderId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, folderId } = await params

  const [folder, member] = await Promise.all([
    prisma.orgFolder.findUnique({ where: { id: folderId } }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canEditFolder(member.role, folder.createdById, userId)) {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }

  const { name, parentId } = await request.json()

  if (parentId !== undefined && parentId !== null) {
    const parent = await prisma.orgFolder.findUnique({ where: { id: parentId }, select: { orgId: true } })
    if (!parent || parent.orgId !== orgId) return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
  }

  const updated = await prisma.orgFolder.update({
    where: { id: folderId },
    data: {
      ...(name !== undefined && { name }),
      ...(parentId !== undefined && { parentId: parentId ?? null }),
    },
    select: { id: true, name: true, parentId: true, createdById: true, createdAt: true, orgId: true },
  })

  if (name !== undefined) emitOrgFileEvent(orgId, { type: 'folder.renamed', payload: { folderId, name } })
  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; folderId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, folderId } = await params

  const [folder, member] = await Promise.all([
    prisma.orgFolder.findUnique({ where: { id: folderId } }),
    prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } }),
  ])
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }

  // Collect all descendant folder IDs recursively
  async function getDescendantIds(id: string): Promise<string[]> {
    const children = await prisma.orgFolder.findMany({ where: { parentId: id }, select: { id: true } })
    const nested = await Promise.all(children.map((c) => getDescendantIds(c.id)))
    return [id, ...children.map((c) => c.id), ...nested.flat()]
  }

  const allIds = await getDescendantIds(folderId)

  await prisma.$transaction([
    // Move files to root
    prisma.orgFile.updateMany({ where: { folderId: { in: allIds } }, data: { folderId: null } }),
    // Delete all folders
    prisma.orgFolder.deleteMany({ where: { id: { in: allIds } } }),
  ])

  emitOrgFileEvent(orgId, { type: 'folder.deleted', payload: { folderId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify types compile + commit**

```bash
bunx tsc --noEmit
git add src/app/api/orgs/
git commit -m "feat(api): add folder CRUD endpoints"
```

---

### Task 11: File tags — GET/POST /file-tags, PATCH/DELETE /file-tags/[tagId]

**Files:**
- Create: `src/app/api/orgs/[orgId]/file-tags/route.ts`
- Create: `src/app/api/orgs/[orgId]/file-tags/[tagId]/route.ts`

- [ ] **Step 1: Create file-tags/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const tags = await prisma.orgFileTag.findMany({ where: { orgId }, orderBy: { name: 'asc' } })
  return NextResponse.json(tags)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }
  const { name, color } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (color && !HEX_COLOR_RE.test(color)) return NextResponse.json({ error: 'color must be #RRGGBB' }, { status: 400 })
  const tag = await prisma.orgFileTag.create({ data: { name: name.trim(), color: color ?? '#6366f1', orgId } })
  emitOrgFileEvent(orgId, { type: 'tag.created', payload: tag })
  return NextResponse.json(tag, { status: 201 })
}
```

- [ ] **Step 2: Create file-tags/[tagId]/route.ts**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitOrgFileEvent } from '@/lib/realtime'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, tagId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }
  const { name, color } = await request.json()
  if (color && !HEX_COLOR_RE.test(color)) return NextResponse.json({ error: 'color must be #RRGGBB' }, { status: 400 })
  const tag = await prisma.orgFileTag.update({
    where: { id: tagId },
    data: { ...(name && { name }), ...(color && { color }) },
  })
  emitOrgFileEvent(orgId, { type: 'tag.updated', payload: tag })
  return NextResponse.json(tag)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; tagId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, tagId } = await params
  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role !== 'admin' && member.role !== 'owner') {
    return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })
  }
  await prisma.orgFileTag.delete({ where: { id: tagId } })
  emitOrgFileEvent(orgId, { type: 'tag.deleted', payload: { tagId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify types compile + commit**

```bash
bunx tsc --noEmit
git add src/app/api/orgs/
git commit -m "feat(api): add file-tags CRUD endpoints"
```

---

### Task 12: SSE endpoint — GET /api/orgs/[orgId]/file-events

**Files:**
- Create: `src/app/api/orgs/[orgId]/file-events/route.ts`

- [ ] **Step 1: Create the SSE route**

```ts
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subscribeOrgFileEvents } from '@/lib/realtime'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return new Response('Unauthorized', { status: 401 })
  const { orgId } = await params

  const member = await prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
  if (!member) return new Response('Forbidden', { status: 403 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': keepalive\n\n'))

      const unsubscribe = subscribeOrgFileEvents(orgId, (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          unsubscribe()
        }
      })

      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 2: Verify types compile + commit**

```bash
bunx tsc --noEmit
git add src/app/api/orgs/
git commit -m "feat(api): add SSE file-events endpoint"
```

---

### Task 13: Client SSE hook — useOrgFileSubscription

**Files:**
- Create: `src/lib/hooks/useOrgFileSubscription.ts`

- [ ] **Step 1: Create the hook**

```ts
'use client'

import { useEffect, useRef } from 'react'
import type { OrgFile, OrgFolder, OrgFileTag } from '@/types'

export interface OrgFileHandlers {
  onFileUploaded?: (file: OrgFile) => void
  onFileRenamed?: (fileId: string, name: string) => void
  onFileMoved?: (fileId: string, folderId: string | null) => void
  onFileDeleted?: (fileId: string) => void
  onFileTagAdded?: (fileId: string, tag: OrgFileTag) => void
  onFileTagRemoved?: (fileId: string, tagId: string) => void
  onFolderCreated?: (folder: OrgFolder) => void
  onFolderRenamed?: (folderId: string, name: string) => void
  onFolderDeleted?: (folderId: string) => void
  onTagCreated?: (tag: OrgFileTag) => void
  onTagUpdated?: (tag: OrgFileTag) => void
  onTagDeleted?: (tagId: string) => void
}

export function useOrgFileSubscription(orgId: string, handlers: OrgFileHandlers) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!orgId) return
    const es = new EventSource(`/api/orgs/${orgId}/file-events`)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string)
        const h = handlersRef.current
        switch (event.type) {
          case 'file.uploaded':    h.onFileUploaded?.(event.payload); break
          case 'file.renamed':     h.onFileRenamed?.(event.payload.fileId, event.payload.name); break
          case 'file.moved':       h.onFileMoved?.(event.payload.fileId, event.payload.folderId); break
          case 'file.deleted':     h.onFileDeleted?.(event.payload.fileId); break
          case 'file.tag_added':   h.onFileTagAdded?.(event.payload.fileId, event.payload.tag); break
          case 'file.tag_removed': h.onFileTagRemoved?.(event.payload.fileId, event.payload.tagId); break
          case 'folder.created':   h.onFolderCreated?.(event.payload); break
          case 'folder.renamed':   h.onFolderRenamed?.(event.payload.folderId, event.payload.name); break
          case 'folder.deleted':   h.onFolderDeleted?.(event.payload.folderId); break
          case 'tag.created':      h.onTagCreated?.(event.payload); break
          case 'tag.updated':      h.onTagUpdated?.(event.payload); break
          case 'tag.deleted':      h.onTagDeleted?.(event.payload.tagId); break
        }
      } catch { /* ignore parse errors */ }
    }

    return () => es.close()
  }, [orgId])
}
```

- [ ] **Step 2: Verify types compile + commit**

```bash
bunx tsc --noEmit
git add src/lib/hooks/
git commit -m "feat(realtime): add useOrgFileSubscription hook"
```

---

## Chunk 3: UI Components and Page

### Task 14: FileIcon component

**Files:**
- Create: `src/components/files/FileIcon.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { FileText, Image, Video, Music, Table2, Presentation, FileCode, Archive, File } from 'lucide-react'

interface Props {
  mimeType: string
  size?: number
  className?: string
}

export function getFileCategory(mimeType: string) {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'document'
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'code'
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('7z')) return 'archive'
  return 'file'
}

export default function FileIcon({ mimeType, size = 20, className = '' }: Props) {
  const category = getFileCategory(mimeType)
  const props = { size, className }

  switch (category) {
    case 'pdf':          return <div className={`flex items-center justify-center rounded text-[10px] font-bold text-white bg-red-500 ${className}`} style={{ width: size, height: size }}>PDF</div>
    case 'image':        return <Image {...props} className={`text-emerald-500 ${className}`} />
    case 'video':        return <Video {...props} className={`text-blue-500 ${className}`} />
    case 'audio':        return <Music {...props} className={`text-purple-500 ${className}`} />
    case 'spreadsheet':  return <Table2 {...props} className={`text-green-600 ${className}`} />
    case 'presentation': return <Presentation {...props} className={`text-orange-500 ${className}`} />
    case 'document':     return <FileText {...props} className={`text-blue-600 ${className}`} />
    case 'code':         return <FileCode {...props} className={`text-muted-foreground ${className}`} />
    case 'archive':      return <Archive {...props} className={`text-amber-700 ${className}`} />
    default:             return <File {...props} className={`text-muted-foreground ${className}`} />
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
```

- [ ] **Step 2: Commit**

```bash
bunx tsc --noEmit
git add src/components/files/
git commit -m "feat(ui): add FileIcon component"
```

---

### Task 15: FilePreviewModal

**Files:**
- Create: `src/components/files/FilePreviewModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { OrgFile } from '@/types'
import { getFileCategory } from './FileIcon'
import { useT } from '@/lib/i18n'

interface Props {
  file: OrgFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function FilePreviewModal({ file, open, onOpenChange }: Props) {
  const { t } = useT()
  const [textContent, setTextContent] = useState<string | null>(null)

  useEffect(() => {
    if (!file || !open) { setTextContent(null); return }
    const category = getFileCategory(file.mimeType)
    if (category !== 'code') return
    fetch(file.url)
      .then((r) => r.text())
      .then(setTextContent)
      .catch(() => setTextContent(null))
  }, [file, open])

  if (!file) return null
  const category = getFileCategory(file.mimeType)

  function renderPreview() {
    if (!file) return null
    switch (category) {
      case 'pdf':
        return <iframe src={file.url} className="w-full h-[70vh] rounded border" title={file.name} />
      case 'image':
        return <img src={file.url} alt={file.name} className="max-h-[70vh] max-w-full mx-auto rounded object-contain" />
      case 'video':
        return <video src={file.url} controls className="max-h-[70vh] w-full rounded" />
      case 'audio':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <audio src={file.url} controls className="w-full" />
          </div>
        )
      case 'code':
        return textContent !== null
          ? <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-4 text-xs">{textContent}</pre>
          : <p className="text-muted-foreground text-sm">Loading...</p>
      default:
        return (
          <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground">
            <p className="text-sm">{t('files_no_preview')}</p>
            <Button asChild variant="outline">
              <a href={file.url} download={file.name}><Download size={14} className="mr-2" />{t('files_download_instead')}</a>
            </Button>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
        </DialogHeader>
        {renderPreview()}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Compile + commit**

```bash
bunx tsc --noEmit
git add src/components/files/
git commit -m "feat(ui): add FilePreviewModal"
```

---

### Task 16: FolderTree component

**Files:**
- Create: `src/components/files/FolderTree.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import type { OrgFolder } from '@/types'
import { useT } from '@/lib/i18n'

interface Props {
  folders: OrgFolder[]
  selectedId: string | null  // null = root
  onSelect: (folderId: string | null) => void
  onCreateFolder: (parentId: string | null) => void
  onRenameFolder: (folder: OrgFolder) => void
  onDeleteFolder: (folder: OrgFolder) => void
  canManage: boolean  // admin or owner
}

function buildTree(folders: OrgFolder[]): OrgFolder[] {
  const map = new Map(folders.map((f) => [f.id, { ...f, children: [] as OrgFolder[] }]))
  const roots: OrgFolder[] = []
  for (const f of map.values()) {
    if (f.parentId) map.get(f.parentId)?.children?.push(f)
    else roots.push(f)
  }
  return roots
}

function FolderNode({
  folder,
  selectedId,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  canManage,
}: Omit<Props, 'folders'> & { folder: OrgFolder }) {
  const [expanded, setExpanded] = useState(false)
  const children = (folder.children ?? []) as OrgFolder[]
  const isSelected = selectedId === folder.id

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}
        onClick={() => onSelect(folder.id)}
      >
        <button
          className="shrink-0 text-muted-foreground"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
        >
          {children.length > 0
            ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="inline-block w-3" />}
        </button>
        {isSelected ? <FolderOpen size={14} className="shrink-0 text-primary" /> : <Folder size={14} className="shrink-0 text-muted-foreground" />}
        <span className="flex-1 truncate">{folder.name}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); onCreateFolder(folder.id) }} className="rounded p-0.5 hover:bg-accent-foreground/10"><Plus size={11} /></button>
          <button onClick={(e) => { e.stopPropagation(); onRenameFolder(folder) }} className="rounded p-0.5 hover:bg-accent-foreground/10"><Pencil size={11} /></button>
          {canManage && <button onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder) }} className="rounded p-0.5 hover:bg-destructive/10 text-destructive"><Trash2 size={11} /></button>}
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div className="pl-4">
          {children.map((child) => (
            <FolderNode key={child.id} folder={child} selectedId={selectedId} onSelect={onSelect} onCreateFolder={onCreateFolder} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FolderTree({ folders, selectedId, onSelect, onCreateFolder, onRenameFolder, onDeleteFolder, canManage }: Props) {
  const { t } = useT()
  const tree = buildTree(folders)

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none ${selectedId === null ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted text-muted-foreground'}`}
        onClick={() => onSelect(null)}
      >
        <FolderOpen size={14} className="shrink-0" />
        {t('folders_root')}
      </div>
      {tree.map((folder) => (
        <FolderNode key={folder.id} folder={folder} selectedId={selectedId} onSelect={onSelect} onCreateFolder={onCreateFolder} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} canManage={canManage} />
      ))}
      <button
        onClick={() => onCreateFolder(null)}
        className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus size={12} />
        {t('folders_new')}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Compile + commit**

```bash
bunx tsc --noEmit
git add src/components/files/
git commit -m "feat(ui): add FolderTree component"
```

---

### Task 17: TagFilterBar component

**Files:**
- Create: `src/components/files/TagFilterBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import type { OrgFileTag } from '@/types'

interface Props {
  tags: OrgFileTag[]
  selected: string[]
  onToggle: (tagId: string) => void
}

export default function TagFilterBar({ tags, selected, onToggle }: Props) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const active = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${active ? 'text-white ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100'}`}
            style={{ backgroundColor: active ? tag.color : tag.color + '33', color: active ? '#fff' : tag.color }}
          >
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Compile + commit**

```bash
bunx tsc --noEmit
git add src/components/files/
git commit -m "feat(ui): add TagFilterBar component"
```

---

### Task 18: FileContextMenu component

**Files:**
- Create: `src/components/files/FileContextMenu.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Link2, Pencil, FolderInput, Tag, Download, Trash2 } from 'lucide-react'
import type { OrgFile } from '@/types'
import { useT } from '@/lib/i18n'

interface Props {
  file: OrgFile
  x: number
  y: number
  canEdit: boolean
  onClose: () => void
  onRename: () => void
  onMove: () => void
  onTags: () => void
  onDelete: () => void
}

export default function FileContextMenu({ file, x, y, canEdit, onClose, onRename, onMove, onTags, onDelete }: Props) {
  const { t } = useT()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  function copyLink() {
    navigator.clipboard.writeText(file.url)
    onClose()
  }

  const items = [
    { icon: Link2, label: t('files_ctx_copy_link'), action: copyLink, show: true },
    { icon: Pencil, label: t('files_ctx_rename'), action: () => { onRename(); onClose() }, show: canEdit },
    { icon: FolderInput, label: t('files_ctx_move'), action: () => { onMove(); onClose() }, show: canEdit },
    { icon: Tag, label: t('files_ctx_tags'), action: () => { onTags(); onClose() }, show: canEdit },
    null, // separator
    { icon: Download, label: t('files_ctx_download'), action: () => { window.open(file.url, '_blank'); onClose() }, show: true },
    null, // separator
    { icon: Trash2, label: t('files_ctx_delete'), action: () => { onDelete(); onClose() }, show: canEdit, danger: true },
  ]

  return (
    <div
      ref={ref}
      style={{ top: y, left: x }}
      className="fixed z-50 min-w-44 rounded-md border bg-popover shadow-lg py-1"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={i} className="my-1 border-t" />
        ) : item.show ? (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent ${item.danger ? 'text-destructive hover:text-destructive' : ''}`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ) : null
      )}
    </div>
  )
}
```

- [ ] **Step 2: Compile + commit**

```bash
bunx tsc --noEmit
git add src/components/files/
git commit -m "feat(ui): add FileContextMenu component"
```

---

### Task 19: Main file library page

**Files:**
- Create: `src/app/orgs/[orgId]/files/page.tsx`

- [ ] **Step 1: Create the page**

This is the main orchestration component. It:
- Fetches files, folders, tags on mount
- Manages selected folder, search, tag filters, sort
- Handles upload, rename, move, delete, tag assignment
- Subscribes to SSE for realtime updates
- Renders three-panel layout

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Upload, Search, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import UserAvatar from '@/components/shared/UserAvatar'
import FolderTree from '@/components/files/FolderTree'
import FileIcon, { formatBytes } from '@/components/files/FileIcon'
import FileContextMenu from '@/components/files/FileContextMenu'
import FilePreviewModal from '@/components/files/FilePreviewModal'
import TagFilterBar from '@/components/files/TagFilterBar'
import { useOrgFileSubscription } from '@/lib/hooks/useOrgFileSubscription'
import { useT } from '@/lib/i18n'
import type { OrgFile, OrgFolder, OrgFileTag } from '@/types'

const FILE_SIZE_LIMIT = 100 * 1024 * 1024

export default function OrgFilesPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const { t } = useT()

  const [files, setFiles] = useState<OrgFile[]>([])
  const [folders, setFolders] = useState<OrgFolder[]>([])
  const [tags, setTags] = useState<OrgFileTag[]>([])
  const [myRole, setMyRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [sort, setSort] = useState<'name' | 'size' | 'createdAt'>('createdAt')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const [previewFile, setPreviewFile] = useState<OrgFile | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ file: OrgFile; x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState<{ file: OrgFile; name: string } | null>(null)
  const [moving, setMoving] = useState<OrgFile | null>(null)
  const [tagging, setTagging] = useState<OrgFile | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const canManage = myRole === 'admin' || myRole === 'owner'

  function canEditFile(file: OrgFile) {
    if (myRole === 'viewer') return false
    if (canManage) return true
    // member: only own files — we need to compare with current user
    // We don't store userId in this component, so we rely on server check
    return true // server enforces the actual check
  }

  // Fetch data
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedFolderId) params.set('folderId', selectedFolderId)
      else if (search) params.set('folderId', 'all')
      if (search) params.set('search', search)
      selectedTagIds.forEach((id) => params.append('tagId', id))
      params.set('sort', sort)
      params.set('order', order)

      const [filesRes, foldersRes, tagsRes, orgRes] = await Promise.all([
        fetch(`/api/orgs/${orgId}/files?${params}`),
        fetch(`/api/orgs/${orgId}/folders`),
        fetch(`/api/orgs/${orgId}/file-tags`),
        fetch(`/api/orgs/${orgId}`),
      ])
      const [filesData, foldersData, tagsData, orgData] = await Promise.all([
        filesRes.json(), foldersRes.json(), tagsRes.json(), orgRes.json(),
      ])
      setFiles(filesData.files ?? [])
      setFolders(foldersData)
      setTags(tagsData)
      setMyRole(orgData.myRole ?? 'member')
    } finally {
      setLoading(false)
    }
  }, [orgId, selectedFolderId, search, selectedTagIds, sort, order])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Upload handler
  async function handleUpload(fileToUpload: File) {
    if (fileToUpload.size > FILE_SIZE_LIMIT) { toast.error(t('files_too_large')); return }
    const formData = new FormData()
    formData.append('file', fileToUpload)
    if (selectedFolderId) formData.append('folderId', selectedFolderId)
    const res = await fetch(`/api/orgs/${orgId}/files`, { method: 'POST', body: formData })
    if (!res.ok) {
      const data = await res.json()
      toast.error(data.error ?? t('files_upload_error'))
    }
  }

  // Realtime
  useOrgFileSubscription(orgId, {
    onFileUploaded: (file) => setFiles((fs) => fs.some((f) => f.id === file.id) ? fs : [file, ...fs]),
    onFileRenamed: (fileId, name) => setFiles((fs) => fs.map((f) => f.id === fileId ? { ...f, name } : f)),
    onFileMoved: (fileId, folderId) => {
      setFiles((fs) => {
        // If viewing specific folder and file moved away, remove it
        if (selectedFolderId !== null && folderId !== selectedFolderId) {
          return fs.filter((f) => f.id !== fileId)
        }
        return fs.map((f) => f.id === fileId ? { ...f, folderId } : f)
      })
    },
    onFileDeleted: (fileId) => setFiles((fs) => fs.filter((f) => f.id !== fileId)),
    onFileTagAdded: (fileId, tag) => setFiles((fs) => fs.map((f) =>
      f.id === fileId ? { ...f, tags: f.tags.some((t) => t.tag.id === tag.id) ? f.tags : [...f.tags, { tag }] } : f
    )),
    onFileTagRemoved: (fileId, tagId) => setFiles((fs) => fs.map((f) =>
      f.id === fileId ? { ...f, tags: f.tags.filter((t) => t.tag.id !== tagId) } : f
    )),
    onFolderCreated: (folder) => setFolders((fs) => fs.some((f) => f.id === folder.id) ? fs : [...fs, folder]),
    onFolderRenamed: (folderId, name) => setFolders((fs) => fs.map((f) => f.id === folderId ? { ...f, name } : f)),
    onFolderDeleted: (folderId) => {
      setFolders((fs) => fs.filter((f) => f.id !== folderId))
      if (selectedFolderId === folderId) setSelectedFolderId(null)
    },
    onTagCreated: (tag) => setTags((ts) => ts.some((t) => t.id === tag.id) ? ts : [...ts, tag]),
    onTagUpdated: (tag) => setTags((ts) => ts.map((t) => t.id === tag.id ? tag : t)),
    onTagDeleted: (tagId) => {
      setTags((ts) => ts.filter((t) => t.id !== tagId))
      setSelectedTagIds((ids) => ids.filter((id) => id !== tagId))
    },
  })

  // Rename submit
  async function submitRename() {
    if (!renaming) return
    const res = await fetch(`/api/orgs/${orgId}/files/${renaming.file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renaming.name }),
    })
    if (!res.ok) toast.error((await res.json()).error)
    setRenaming(null)
  }

  // Delete file
  async function deleteFile(file: OrgFile) {
    if (!confirm(t('files_delete_confirm'))) return
    const res = await fetch(`/api/orgs/${orgId}/files/${file.id}`, { method: 'DELETE' })
    if (!res.ok) toast.error((await res.json()).error)
  }

  // Create folder
  async function createFolder(parentId: string | null) {
    const name = prompt(t('folders_new_ph'))
    if (!name?.trim()) return
    const res = await fetch(`/api/orgs/${orgId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId }),
    })
    if (!res.ok) toast.error((await res.json()).error)
  }

  // Rename folder
  async function renameFolder(folder: OrgFolder) {
    const name = prompt(t('folders_rename_ph'), folder.name)
    if (!name?.trim() || name === folder.name) return
    const res = await fetch(`/api/orgs/${orgId}/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) toast.error((await res.json()).error)
  }

  // Delete folder
  async function deleteFolder(folder: OrgFolder) {
    if (!confirm(t('folders_delete_warning'))) return
    const res = await fetch(`/api/orgs/${orgId}/folders/${folder.id}`, { method: 'DELETE' })
    if (!res.ok) toast.error((await res.json()).error)
  }

  // Move file dialog (select folder)
  async function moveFile(file: OrgFile, targetFolderId: string | null) {
    const res = await fetch(`/api/orgs/${orgId}/files/${file.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: targetFolderId }),
    })
    if (!res.ok) toast.error((await res.json()).error)
    setMoving(null)
  }

  // Tag toggle on file
  async function toggleTag(file: OrgFile, tagId: string) {
    const has = file.tags.some((t) => t.tag.id === tagId)
    const method = has ? 'DELETE' : 'POST'
    await fetch(`/api/orgs/${orgId}/files/${file.id}/tags/${tagId}`, { method })
  }

  function cycleSortBy(col: 'name' | 'size' | 'createdAt') {
    if (sort === col) setOrder((o) => o === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder('asc') }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <h1 className="text-lg font-semibold shrink-0">{t('files_title')}</h1>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('files_search_ph')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <TagFilterBar tags={tags} selected={selectedTagIds} onToggle={(id) => setSelectedTagIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])} />
        {myRole !== 'viewer' && (
          <>
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} className="mr-1.5" />
              {t('files_upload')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => Array.from(e.target.files ?? []).forEach(handleUpload)}
            />
          </>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Folder tree panel */}
        <div className="w-52 shrink-0 border-r overflow-y-auto p-2">
          <FolderTree
            folders={folders}
            selectedId={selectedFolderId}
            onSelect={setSelectedFolderId}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
            canManage={canManage}
          />
        </div>

        {/* File list */}
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_120px_110px] gap-2 px-4 py-2 text-xs text-muted-foreground border-b sticky top-0 bg-background">
            <button className="flex items-center gap-1 text-left hover:text-foreground" onClick={() => cycleSortBy('name')}>
              {t('files_col_name')} <ArrowUpDown size={10} />
            </button>
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => cycleSortBy('size')}>
              {t('files_col_size')} <ArrowUpDown size={10} />
            </button>
            <span>{t('files_col_uploader')}</span>
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => cycleSortBy('createdAt')}>
              {t('files_col_date')} <ArrowUpDown size={10} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading...</div>
          ) : files.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('files_empty')}</div>
          ) : (
            files.map((file) => (
              <div
                key={file.id}
                className="group grid grid-cols-[1fr_80px_120px_110px] gap-2 px-4 py-2.5 text-sm hover:bg-muted cursor-pointer border-b border-border/50"
                onClick={() => { setPreviewFile(file); setPreviewOpen(true) }}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ file, x: e.clientX, y: e.clientY }) }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileIcon mimeType={file.mimeType} size={18} className="shrink-0" />
                  {renaming?.file.id === file.id ? (
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      onBlur={submitRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null) }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded border bg-background px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <span className="truncate">{file.name}</span>
                  )}
                  {file.tags.length > 0 && (
                    <div className="hidden group-hover:flex items-center gap-1">
                      {file.tags.slice(0, 3).map((t) => (
                        <span key={t.tag.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: t.tag.color }}>
                          {t.tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground">{formatBytes(file.size)}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <UserAvatar user={file.uploader} size={18} />
                  <span className="truncate text-muted-foreground">{file.uploader.name}</span>
                </div>
                <span className="text-muted-foreground">{new Date(file.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          file={contextMenu.file}
          x={contextMenu.x}
          y={contextMenu.y}
          canEdit={canEditFile(contextMenu.file)}
          onClose={() => setContextMenu(null)}
          onRename={() => setRenaming({ file: contextMenu.file, name: contextMenu.file.name })}
          onMove={() => setMoving(contextMenu.file)}
          onTags={() => setTagging(contextMenu.file)}
          onDelete={() => deleteFile(contextMenu.file)}
        />
      )}

      {/* Move dialog — simple folder picker */}
      {moving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMoving(null)}>
          <div className="w-64 rounded-lg border bg-popover shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-medium text-sm">{t('files_ctx_move')}</p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              <button onClick={() => moveFile(moving, null)} className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted">{t('folders_root')}</button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => moveFile(moving, f.id)} className="rounded px-2 py-1.5 text-sm text-left hover:bg-muted">{f.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tag picker */}
      {tagging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTagging(null)}>
          <div className="w-64 rounded-lg border bg-popover shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-medium text-sm">{t('files_ctx_tags')}</p>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('tags_title')} (admin can create)</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const has = tagging.tags.some((t) => t.tag.id === tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tagging, tag.id)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium text-white transition-opacity ${has ? 'opacity-100 ring-2 ring-offset-1 ring-white' : 'opacity-50 hover:opacity-80'}`}
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview modal */}
      <FilePreviewModal file={previewFile} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  )
}
```

- [ ] **Step 2: Compile + commit**

```bash
bunx tsc --noEmit
git add src/app/orgs/ src/components/files/
git commit -m "feat(ui): add org file library page"
```

---

### Task 20: Final integration smoke test

- [ ] **Step 1: Start dev server**

```bash
bun run dev
```

- [ ] **Step 2: Manual verification checklist**

1. Navigate to an org → click "文件库" in sidebar → library page loads
2. Upload a file → appears in file list (including in another browser tab via SSE)
3. Create a folder → appears in folder tree
4. Move a file to the folder → disappears from root, visible when folder selected
5. Right-click a file → context menu appears with correct options
6. Left-click a file → preview modal opens (PDF renders in iframe, image shows inline)
7. Admin: create a tag → tag appears in filter bar
8. Add tag to file → tag chip appears; toggle filter → file list filters
9. Delete a file → disappears from list in both tabs
10. Viewer: upload button hidden, context menu shows only Copy Link + Download

- [ ] **Step 3: Final commit + push**

```bash
git add -A
git commit -m "feat: org-level file library with folders, tags, and realtime sync"
git push
```
