# Org File Library — Design Spec

**Date:** 2026-03-29
**Status:** Approved

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
| `member` | Upload + manage own files, create folders/tags |
| `viewer` | Read-only access, can download |

**Permission matrix:**

| Operation | viewer | member | admin | owner |
|---|---|---|---|---|
| List files / download | ✓ | ✓ | ✓ | ✓ |
| Upload files | ✗ | ✓ | ✓ | ✓ |
| Create folders | ✗ | ✓ | ✓ | ✓ |
| Rename/move own files | ✗ | ✓ | ✓ | ✓ |
| Rename/move others' files | ✗ | ✗ | ✓ | ✓ |
| Delete own files | ✗ | ✓ | ✓ | ✓ |
| Delete others' files | ✗ | ✗ | ✓ | ✓ |
| Delete folders (cascade) | ✗ | ✗ | ✓ | ✓ |
| Create/delete tags | ✗ | ✗ | ✓ | ✓ |

---

## Data Model

### New Prisma models

```prisma
model OrgFolder {
  id          String      @id @default(cuid())
  name        String
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  parentId    String?
  parent      OrgFolder?  @relation("FolderTree", fields: [parentId], references: [id])
  children    OrgFolder[] @relation("FolderTree")
  files       OrgFile[]
  createdById String
  createdBy   User        @relation(fields: [createdById], references: [id])
  createdAt   DateTime    @default(now())
}

model OrgFile {
  id         String               @id @default(cuid())
  name       String
  url        String
  key        String               // Qiniu object key (for deletion)
  size       Int                  // bytes
  mimeType   String
  orgId      String
  org        Organization         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  folderId   String?              // null = root
  folder     OrgFolder?           @relation(fields: [folderId], references: [id])
  uploaderId String
  uploader   User                 @relation(fields: [uploaderId], references: [id])
  tags       OrgFileTagAssignment[]
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt
}

model OrgFileTag {
  id          String               @id @default(cuid())
  name        String
  color       String               @default("#6366f1")
  orgId       String
  org         Organization         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  files       OrgFileTagAssignment[]
  createdAt   DateTime             @default(now())
}

model OrgFileTagAssignment {
  fileId String
  tagId  String
  file   OrgFile    @relation(fields: [fileId], references: [id], onDelete: Cascade)
  tag    OrgFileTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([fileId, tagId])
}
```

### Schema change to OrgMember

No structural change — `role String @default("member")` stays as-is. New valid values: `"owner"`, `"admin"`, `"member"`, `"viewer"`. Migration updates invite default; existing members keep `"member"`.

---

## API Routes

All routes are under `/api/orgs/[orgId]/`. Auth via `x-user-id` header (injected by proxy). All check org membership before proceeding.

### Files

| Method | Path | Description | Min role |
|---|---|---|---|
| GET | `/files` | List files (query: `folderId`, `search`, `tagId`) | viewer |
| POST | `/files` | Upload file (multipart/form-data: `file`, `folderId?`) | member |
| PATCH | `/files/[fileId]` | Rename (`name`) or move (`folderId`) | member (own) / admin (any) |
| DELETE | `/files/[fileId]` | Delete from DB + Qiniu | member (own) / admin (any) |
| POST | `/files/[fileId]/tags/[tagId]` | Add tag to file | member (own) / admin (any) |
| DELETE | `/files/[fileId]/tags/[tagId]` | Remove tag from file | member (own) / admin (any) |

### Folders

| Method | Path | Description | Min role |
|---|---|---|---|
| GET | `/folders` | Full folder tree | viewer |
| POST | `/folders` | Create folder (`name`, `parentId?`) | member |
| PATCH | `/folders/[folderId]` | Rename or reparent | member (own) / admin (any) |
| DELETE | `/folders/[folderId]` | Cascade-delete folder + contents | admin |

### Tags

| Method | Path | Description | Min role |
|---|---|---|---|
| GET | `/file-tags` | List all org tags | viewer |
| POST | `/file-tags` | Create tag (`name`, `color`) | admin |
| DELETE | `/file-tags/[tagId]` | Delete tag | admin |

### Realtime

| Method | Path | Description |
|---|---|---|
| GET | `/files/events` | SSE stream for file library changes |

**SSE event types:** `file.uploaded`, `file.renamed`, `file.moved`, `file.deleted`, `folder.created`, `folder.renamed`, `folder.deleted`, `tag.created`, `tag.deleted`

Each event payload contains the full mutated object so clients can apply updates without a refetch.

---

## Realtime Architecture

Reuses the existing in-process `EventEmitter` pattern from `src/lib/realtime.ts`:

```
emitOrgFileEvent(orgId, { type, payload })
subscribeOrgFileEvents(orgId, handler)
```

New SSE endpoint `GET /api/orgs/[orgId]/files/events`:
- Verifies org membership
- Subscribes to `org-files:{orgId}` channel
- Streams events as `data: {...}\n\n`
- Cleans up on request abort

Client hook `useOrgFileSubscription(orgId, handlers)` — same `handlersRef` pattern as `useBoardSubscription`.

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

| Category | MIME prefix / type | Icon |
|---|---|---|
| PDF | `application/pdf` | 🔴 PDF badge |
| Image | `image/*` | thumbnail preview |
| Video | `video/*` | 🎬 |
| Audio | `audio/*` | 🎵 |
| Spreadsheet | `application/vnd.ms-excel`, `spreadsheetml` | 📊 |
| Word | `application/msword`, `wordprocessingml` | 📝 |
| Presentation | `presentationml`, `powerpoint` | 📊 |
| Archive | `zip`, `tar`, `gzip`, `7z` | 📦 |
| Code | `text/`, `json`, `xml` | 💻 |
| Other | * | 📄 |

### Preview Modal (left click)

- **PDF:** `<iframe src={url}>` full-height embed
- **Image:** `<img>` with zoom
- **Video:** `<video controls>`
- **Audio:** `<audio controls>` with waveform placeholder
- **Others:** "此文件格式暂不支持预览" + Download button

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

### Tag Filter Bar

Colored pill chips below the toolbar. Click to toggle filter. Multiple tags = AND filter. Active tag = filled, inactive = outlined.

### Folder Tree (left panel)

- Collapsible tree, current folder highlighted
- Drag-and-drop files into folders
- Right-click folder: Rename, New Subfolder, Delete (admin+)
- Breadcrumb trail above file list

---

## Supported File Formats

Any format can be uploaded (no restrictions). Preview support:

| Format | Preview method |
|---|---|
| `.pdf` | iframe embed |
| `.png .jpg .jpeg .gif .webp .svg .avif` | `<img>` |
| `.mp4 .webm .mov` | `<video>` |
| `.mp3 .wav .ogg .m4a` | `<audio>` |
| `.md .txt .csv .json .xml .html .css .js .ts` | syntax-highlighted `<pre>` (via existing MD editor or plain pre) |
| All others | Download button |

---

## File Naming & Dedup

Reuses existing Qiniu MD5-dedup logic from `src/lib/qiniu.ts`. The `key` stored in `OrgFile` enables deletion via Qiniu's RS API when a file is removed from the library.

---

## Error States

- Qiniu not configured → upload button shows tooltip "请先配置 Qiniu 存储"
- Upload fails → toast error with server message
- File too large (>100 MB) → client-side guard before upload, with clear message
- Permission denied → 403 → toast "权限不足"
- File not found (deleted by another user in realtime) → ghost entry removed via SSE before user can click

---

## Out of Scope

- File versioning
- In-browser editing (Google Docs style)
- File sharing with external (non-org) users
- Full-text search inside documents
