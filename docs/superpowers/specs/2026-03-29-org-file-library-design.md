# Org File Library — Design Spec

**Date:** 2026-03-29
**Status:** Approved (rev 2)

---

## Overview

An org-level shared file library where all organization members can upload, organize, and access documents. Built for use cases like PhD research — managing papers, datasets, and notes across subjects — and shared with all org members. Files are stored on Qiniu, tracked in PostgreSQL, and synchronized in realtime via SSE.

---

## Role Model

Extends existing `OrgMember.role` string field from `"owner" | "member"` to four tiers:

| Role | Description |
|---|---|
| `owner` | Full control including org management |
| `admin` | Full file control, cannot manage org membership |
| `member` | Upload + manage own files, create folders |
| `viewer` | Read-only access, can download |

**Permission matrix:**

| Operation | viewer | member | admin | owner |
|---|---|---|---|---|
| List files / download | ✓ | ✓ | ✓ | ✓ |
| Upload files | ✗ | ✓ | ✓ | ✓ |
| Create folders | ✗ | ✓ | ✓ | ✓ |
| Rename own files/folders | ✗ | ✓ | ✓ | ✓ |
| Move own files | ✗ | ✓ | ✓ | ✓ |
| Rename/move others' files/folders | ✗ | ✗ | ✓ | ✓ |
| Delete own files | ✗ | ✓ | ✓ | ✓ |
| Delete others' files | ✗ | ✗ | ✓ | ✓ |
| Delete folders (cascade) | ✗ | ✗ | ✓ | ✓ |
| Create/delete/manage tags | ✗ | ✗ | ✓ | ✓ |

**"Own file/folder"** = uploaded/created by the requesting user (`uploaderId` / `createdById === userId`).

**Folder access model:** All org members can see and navigate the full folder tree. There are no folder-level permission restrictions — folder visibility is org-wide. A member may move their own files into any folder in the org regardless of who created that folder.

---

## Data Model

### New Prisma models

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
  createdBy   User         @relation(fields: [createdById], references: [id])
  createdAt   DateTime     @default(now())
}

model OrgFile {
  id         String                 @id @default(cuid())
  name       String
  url        String
  key        String                 // Qiniu object key (required for deletion via RS API)
  size       Int                    // bytes
  mimeType   String                 // captured from file.type on upload
  orgId      String
  org        Organization           @relation(fields: [orgId], references: [id], onDelete: Cascade)
  folderId   String?                // null = root
  folder     OrgFolder?             @relation(fields: [folderId], references: [id], onDelete: SetNull)
  uploaderId String
  uploader   User                   @relation(fields: [uploaderId], references: [id])
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

### Organization model back-relations (additions)

```prisma
model Organization {
  // ... existing fields unchanged ...
  folders  OrgFolder[]
  files    OrgFile[]
  fileTags OrgFileTag[]
}
```

### Schema change to OrgMember

No structural change — `role String @default("member")` stays as-is. New valid values: `"owner"`, `"admin"`, `"member"`, `"viewer"`. Existing members keep `"member"`.

### OnDelete semantics

- `OrgFolder` deleted → child files: `folderId` set to `null` (moves to root), NOT cascade-deleted. This prevents accidental data loss.
- `OrgFile` deleted → tag assignments: cascade-deleted.
- `OrgFileTag` deleted → tag assignments: cascade-deleted.
- `Organization` deleted → all folders, files, tags: cascade-deleted.

---

## API Routes

All routes are under `/api/orgs/[orgId]/`. Auth via `x-user-id` header (injected by proxy). All check org membership before proceeding.

### Files

| Method | Path | Description | Min role |
|---|---|---|---|
| GET | `/files` | List files (query params below) | viewer |
| POST | `/files` | Upload file (multipart: `file`, `folderId?`) | member |
| PATCH | `/files/[fileId]` | Rename (`name`) or move (`folderId`) | member (own) / admin (any) |
| DELETE | `/files/[fileId]` | Delete from DB + Qiniu RS API | member (own) / admin (any) |
| POST | `/files/[fileId]/tags/[tagId]` | Add tag to file | member (own) / admin (any) |
| DELETE | `/files/[fileId]/tags/[tagId]` | Remove tag from file | member (own) / admin (any) |

**GET /files query parameters:**
- `folderId` — filter by folder (omit for root, `all` for all files across folders)
- `search` — substring match on filename, case-insensitive; applies across all folders regardless of `folderId`
- `tagId` — can be repeated; multiple `tagId` params are AND-filtered

**POST /files:**
- `mimeType` captured from `file.type` (File object in FormData)
- Server rejects files > 100 MB with `413 Payload Too Large`
- Qiniu key generated via existing MD5-dedup logic in `src/lib/qiniu.ts`

**DELETE /files/[fileId]:**
1. Fetch file record (including `key`, `orgId`)
2. Check permission (own or admin+)
3. Delete DB record
4. Call Qiniu RS API: `BucketManager.delete(bucket, key)` — uses same credentials as upload
5. If Qiniu deletion fails: log the error but do NOT roll back DB deletion (orphaned Qiniu objects are acceptable; missing DB records are not)
6. Emit `file.deleted` SSE event

### Folders

| Method | Path | Description | Min role |
|---|---|---|---|
| GET | `/folders` | Full folder tree (all folders, org-wide) | viewer |
| POST | `/folders` | Create folder (`name`, `parentId?`) | member |
| PATCH | `/folders/[folderId]` | Rename (`name`) or reparent (`parentId`) | member (own) / admin (any) |
| DELETE | `/folders/[folderId]` | Delete folder; child files move to root (SetNull) | admin |

**DELETE /folders/[folderId]:**
1. Fetch folder + all descendant folder IDs (recursive)
2. Set `folderId = null` on all files in those folders (bulk update)
3. Delete all descendant folders
4. Emit `folder.deleted` SSE event (single event with `{ folderId }`)
5. Emit `file.moved` SSE events for each affected file (bulk, with new `folderId: null`)
- All DB operations in a single `$transaction`; SSE emitted only after transaction commits

### Tags

| Method | Path | Description | Min role |
|---|---|---|---|
| GET | `/file-tags` | List all org tags | viewer |
| POST | `/file-tags` | Create tag (`name`, `color`) | admin |
| DELETE | `/file-tags/[tagId]` | Delete tag (removes all assignments) | admin |

### Realtime SSE

| Method | Path | Description |
|---|---|---|
| GET | `/file-events` | SSE stream for file library changes |

Path is `/file-events` (not `/files/events`) to avoid Next.js App Router route conflicts with the `/files` collection endpoint.

---

## Realtime Architecture

Extends `src/lib/realtime.ts` with org-file channels:

```ts
emitOrgFileEvent(orgId: string, event: OrgFileEvent)
subscribeOrgFileEvents(orgId: string, handler): () => void
```

Channel key: `org-files:{orgId}`

**SSE event types and payloads:**

```ts
{ type: 'file.uploaded',  payload: OrgFile & { tags: OrgFileTagAssignment[] } }
{ type: 'file.renamed',   payload: { fileId: string, name: string } }
{ type: 'file.moved',     payload: { fileId: string, folderId: string | null } }
{ type: 'file.deleted',   payload: { fileId: string } }
{ type: 'folder.created', payload: OrgFolder }
{ type: 'folder.renamed', payload: { folderId: string, name: string } }
{ type: 'folder.deleted', payload: { folderId: string } }
{ type: 'tag.created',    payload: OrgFileTag }
{ type: 'tag.deleted',    payload: { tagId: string } }
```

Client hook `useOrgFileSubscription(orgId, handlers)` — same `handlersRef` pattern as `useBoardSubscription` (no reconnect on handler change).

---

## UI

### Page

`/orgs/[orgId]/files` — new entry in the org sidebar nav (📁 文件库).

### Layout

Three-panel design:

```
┌──────────────────────────────────────────────────────────┐
│  [+ Upload]  [🔍 search]  [tag chips...]     [⊞ list ⊟] │  ← toolbar
├────────────────┬─────────────────────────────────────────┤
│                │  name ↕      size ↕   uploader   date ↕ │
│ 📁 根目录      │  📄 论文草稿.pdf   2.1 MB  Alex  Mar 29 │
│  📁 统计学     │  🖼 实验图.png     450 KB  Bob   Mar 28 │
│  📁 生物学     │  📊 数据.xlsx      1.2 MB  Alex  Mar 27 │
│  📁 文献综述   │                                         │
│                │                                         │
│ [+ 新建文件夹] │                                         │
└────────────────┴─────────────────────────────────────────┘
```

### File Icons (by MIME type)

| Category | MIME match | Icon color/badge |
|---|---|---|
| PDF | `application/pdf` | Red "PDF" badge |
| Image | `image/*` | Thumbnail preview |
| Video | `video/*` | Blue film icon |
| Audio | `audio/*` | Purple music icon |
| Spreadsheet | `vnd.ms-excel`, `spreadsheetml` | Green grid icon |
| Presentation | `presentationml`, `powerpoint` | Orange slides icon |
| Word | `msword`, `wordprocessingml` | Blue doc icon |
| Archive | `zip`, `tar`, `gzip`, `x-7z` | Brown box icon |
| Code/Text | `text/*`, `json`, `xml` | Gray code icon |
| Other | * | Gray file icon |

### Preview Modal (left click)

- **PDF:** `<iframe src={url}>` full-height embed
- **Image:** `<img>` with zoom (click to zoom)
- **Video:** `<video controls>`
- **Audio:** `<audio controls>`
- **Plain text / code / CSV:** syntax-highlighted `<pre>` (fetched from Qiniu URL)
- **Others:** "此文件格式暂不支持预览，请下载后查看" + Download button

### Context Menu (right click)

```
📋 复制链接
✏️ 重命名          (member own / admin any)
📁 移动到文件夹     (member own / admin any)
🏷 添加/移除标签    (member own / admin any)
─────────────
⬇️ 下载
─────────────
🗑 删除            (member own / admin any)
```

Viewer role sees only: 复制链接, 下载. Rename/Move/Tag/Delete are hidden for viewers and for members viewing others' files.

### Tag Filter Bar

Colored pill chips below the toolbar. Click to toggle. Multiple active tags = AND filter. Shows file count per tag.

### Folder Tree (left panel)

- Collapsible tree, current folder highlighted
- Drag-and-drop files into folders
- Right-click folder → Rename, New Subfolder, Delete *(admin+ only for delete)*
- Breadcrumb trail above file list
- "根目录" entry always shown at top (selects `folderId=undefined`)

---

## Supported File Formats

Any format can be uploaded (no type restrictions). Server-side size limit: 100 MB. Preview support:

| Format | Preview method |
|---|---|
| `.pdf` | iframe embed |
| `.png .jpg .jpeg .gif .webp .svg .avif` | `<img>` |
| `.mp4 .webm .mov` | `<video>` |
| `.mp3 .wav .ogg .m4a` | `<audio>` |
| `.md .txt .csv .json .xml .html .css .js .ts .py .go` | syntax-highlighted `<pre>` |
| All others | Download button only |

---

## Error Handling

### API error responses

All errors return `{ error: string, code?: string }`:

| Condition | Status | code |
|---|---|---|
| Not org member | 403 | `FORBIDDEN` |
| Permission insufficient (viewer uploads, member deletes others') | 403 | `PERMISSION_DENIED` |
| Qiniu not configured | 503 | `STORAGE_UNCONFIGURED` |
| File > 100 MB | 413 | `FILE_TOO_LARGE` |
| File not found | 404 | `NOT_FOUND` |
| Qiniu upload failed | 503 | `UPLOAD_FAILED` |

### UI error states

- Qiniu not configured → upload button disabled with tooltip "请先在设置中配置 Qiniu 存储"
- Upload fails → toast with server error message
- File > 100 MB → client-side guard before upload with message "文件不能超过 100 MB"
- Permission denied → toast "权限不足"
- File deleted by another user during session → SSE `file.deleted` removes it from the list immediately

---

## File Naming & Dedup

Reuses existing Qiniu MD5-dedup logic from `src/lib/qiniu.ts`. The `key` stored in `OrgFile` is the Qiniu object key required for deletion via `BucketManager.delete(bucket, key)`. The `uploadToQiniu` function must be extended (or a separate `deleteFromQiniu(key)` helper added) to support RS deletions.

---

## Out of Scope

- File versioning
- In-browser editing (Google Docs style)
- File sharing with external (non-org) users
- Full-text search inside documents
- Folder-level permission restrictions (all folders are org-wide visible)
