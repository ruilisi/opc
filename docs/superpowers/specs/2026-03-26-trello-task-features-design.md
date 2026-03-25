# Trello-Style Task Features Design

**Date:** 2026-03-26
**Status:** Approved

## Overview

Add full Trello-equivalent task features to OPC: multiple members, colored labels, due dates, checklists, cover colors, and file attachments. All features are implemented in one pass (Approach A) to avoid shipping a half-finished UI.

---

## Schema Changes

### New fields on `Task`
```prisma
dueDate  DateTime?
cover    String?    // hex color e.g. "#4CAF50", or null
```

### Remove from `Task`
```prisma
// Remove: assigneeId String?
// Remove: assignee   User? @relation(...)
```

### New models

```prisma
model TaskMember {
  id     String @id @default(cuid())
  taskId String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([taskId, userId])
}

model Label {
  id      String      @id @default(cuid())
  name    String
  color   String      // hex color
  boardId String
  board   Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks   TaskLabel[]
}

model TaskLabel {
  taskId  String
  task    Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  labelId String
  label   Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)
  @@id([taskId, labelId])
}

model ChecklistItem {
  id        String   @id @default(cuid())
  text      String
  checked   Boolean  @default(false)
  order     Int
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Attachment {
  id        String   @id @default(cuid())
  url       String
  name      String
  size      Int
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

### Migration strategy
1. Add new tables and Task fields in one migration
2. Data migration: copy existing `assigneeId` rows into `TaskMember` join table
3. Drop `assigneeId` column in a second migration

---

## API Changes

### Updated endpoints

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/tasks/[taskId]` | Include `members`, `labels`, `checklist`, `attachments` |
| `PATCH` | `/api/tasks/[taskId]` | Add `dueDate`, `cover` fields; remove `assigneeId` |
| `GET` | `/api/boards/[boardId]` (page query) | Include task members, labels, checklist `_count` |

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tasks/[taskId]/members` | Add member `{ userId }` |
| `DELETE` | `/api/tasks/[taskId]/members/[userId]` | Remove member |
| `GET` | `/api/boards/[boardId]/labels` | List board labels |
| `POST` | `/api/boards/[boardId]/labels` | Create label `{ name, color }` |
| `PATCH` | `/api/boards/[boardId]/labels/[labelId]` | Rename/recolor label |
| `DELETE` | `/api/boards/[boardId]/labels/[labelId]` | Delete label |
| `POST` | `/api/tasks/[taskId]/labels/[labelId]` | Assign label to task |
| `DELETE` | `/api/tasks/[taskId]/labels/[labelId]` | Remove label from task |
| `POST` | `/api/tasks/[taskId]/checklist` | Add item `{ text }` |
| `PATCH` | `/api/tasks/[taskId]/checklist/[itemId]` | Update `{ text?, checked? }` |
| `DELETE` | `/api/tasks/[taskId]/checklist/[itemId]` | Delete item |
| `POST` | `/api/tasks/[taskId]/attachments` | Upload file (multipart) |
| `DELETE` | `/api/tasks/[taskId]/attachments/[attachmentId]` | Delete attachment |

---

## UI Changes

### TaskDetailDialog (full redesign)

Single-column layout matching Trello:

**Header area (above description):**
- Members — avatar stack with `+` button → member picker popover (board members only, search by name)
- Labels — colored pills with `+` button → label picker popover (create new inline)
- Due date — date input with clear button; renders red if overdue, yellow if due today
- Cover — row of 8 color swatches + none option; sets colored strip at top of dialog

**Body:**
- Description (existing markdown editor)
- Checklist section — progress bar (`checked/total`), list of items with checkbox + text + delete, "Add an item" input at bottom
- Attachments section — upload button, grid of thumbnails/file cards with name, size, delete
- Comments (existing)

### TaskCard updates

- **Cover strip** — 6px colored top border when `cover` is set
- **Labels row** — small colored pills (name truncated to ~12 chars) below title
- **Footer row** (replacing current footer):
  - Due date badge — red if overdue, gray otherwise
  - Checklist badge — `✓ 3/5` shown if any items exist
  - Attachment count badge
  - Comment count (existing)
  - Member avatar stack — up to 3 avatars, then `+N`, right-aligned

### Board page query

Board page server component includes per-task:
```ts
tasks: {
  include: {
    members: { include: { user: { select: { id, name, avatarUrl } } } },
    labels: { include: { label: true } },
    _count: { select: { checklist: true, attachments: true, comments: true } },
    checklist: { where: { checked: true }, select: { id: true } }, // for checked count
  }
}
```

---

## File Summary

| Action | Path |
|--------|------|
| Edit | `prisma/schema.prisma` |
| Create | `prisma/migrations/.../add_task_features/migration.sql` |
| Create | `scripts/migrate-task-members.ts` |
| Create | `prisma/migrations/.../drop_assignee_id/migration.sql` |
| Edit | `src/app/api/tasks/[taskId]/route.ts` |
| Create | `src/app/api/tasks/[taskId]/members/route.ts` |
| Create | `src/app/api/tasks/[taskId]/members/[userId]/route.ts` |
| Create | `src/app/api/boards/[boardId]/labels/route.ts` |
| Create | `src/app/api/boards/[boardId]/labels/[labelId]/route.ts` |
| Create | `src/app/api/tasks/[taskId]/labels/[labelId]/route.ts` |
| Create | `src/app/api/tasks/[taskId]/checklist/route.ts` |
| Create | `src/app/api/tasks/[taskId]/checklist/[itemId]/route.ts` |
| Create | `src/app/api/tasks/[taskId]/attachments/route.ts` |
| Create | `src/app/api/tasks/[taskId]/attachments/[attachmentId]/route.ts` |
| Edit | `src/app/boards/[boardId]/page.tsx` |
| Edit | `src/components/board/TaskDetailDialog.tsx` |
| Edit | `src/components/board/TaskCard.tsx` |
| Edit | `src/components/board/KanbanBoard.tsx` |
