# Trello Task Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full Trello-equivalent task features — multiple members, colored labels, due dates, checklists, cover colors, and file attachments — to OPC's kanban boards.

**Architecture:** Schema-first approach: one migration adds all new tables/fields, a data migration moves existing `assigneeId` rows into `TaskMember`, then a second migration drops the old column. UI is rebuilt around a Trello-style single-column `TaskDetailDialog` with inline sections for each feature.

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, TypeScript, Tailwind v4, shadcn/ui, @uiw/react-md-editor, Qiniu SDK (existing upload infra)

**Spec:** `docs/superpowers/specs/2026-03-26-trello-task-features-design.md`

---

## Chunk 1: Schema & Migration

### Task 1: Add new models to schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] Add `dueDate DateTime?` and `cover String?` to the `Task` model (keep `assigneeId` for now — dropped later)

- [ ] Add `TaskMember` model after `Task`:
```prisma
model TaskMember {
  id     String @id @default(cuid())
  taskId String
  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([taskId, userId])
}
```

- [ ] Add `Label` model after `Board`:
```prisma
model Label {
  id      String      @id @default(cuid())
  name    String
  color   String
  boardId String
  board   Board       @relation(fields: [boardId], references: [id], onDelete: Cascade)
  tasks   TaskLabel[]
}
```

- [ ] Add `TaskLabel` model:
```prisma
model TaskLabel {
  taskId  String
  task    Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  labelId String
  label   Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)
  @@id([taskId, labelId])
}
```

- [ ] Add `ChecklistItem` model:
```prisma
model ChecklistItem {
  id        String   @id @default(cuid())
  text      String
  checked   Boolean  @default(false)
  order     Int      @default(0)
  taskId    String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

- [ ] Add `Attachment` model:
```prisma
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

- [ ] Add back-relations to existing models:
  - `Task`: add `members TaskMember[]`, `labels TaskLabel[]`, `checklist ChecklistItem[]`, `attachments Attachment[]`
  - `User`: add `taskMembers TaskMember[]`
  - `Board`: add `labels Label[]`

- [ ] Run migration:
```bash
bunx prisma migrate dev --name add_task_features
```
Expected: new migration file created, DB updated.

- [ ] Regenerate client:
```bash
bunx prisma generate
```

### Task 2: Data migration — copy assigneeId → TaskMember

**Files:**
- Create: `scripts/migrate-task-members.ts`

- [ ] Create the script:
```ts
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/opc_development' })

async function main() {
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const tasks = await prisma.task.findMany({ where: { assigneeId: { not: null } } })
  console.log(`Migrating ${tasks.length} tasks with assigneeId...`)

  for (const task of tasks) {
    if (!task.assigneeId) continue
    await prisma.taskMember.upsert({
      where: { taskId_userId: { taskId: task.id, userId: task.assigneeId } },
      create: { taskId: task.id, userId: task.assigneeId },
      update: {},
    })
  }

  console.log('Done.')
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] Run it:
```bash
bunx tsx scripts/migrate-task-members.ts
```
Expected: `Done.` with count of migrated tasks.

### Task 3: Drop assigneeId

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `scripts/migrate-task-members.ts` (already excluded from tsconfig)

- [ ] Remove `assigneeId String?`, `assignee User? @relation(...)` from `Task` model
- [ ] Remove `assignedTasks Task[] @relation("TaskAssignee")` from `User` model

- [ ] Run migration:
```bash
bunx prisma migrate dev --name drop_task_assignee_id
```

- [ ] Regenerate:
```bash
bunx prisma generate
```

- [ ] Update `src/types/index.ts` — replace `assignee` with `members`:
```ts
export interface TaskMember {
  user: { id: string; name: string; avatarUrl?: string | null }
}

export interface TaskLabel {
  label: { id: string; name: string; color: string }
}

export interface ChecklistItem {
  id: string
  text: string
  checked: boolean
  order: number
}

export interface Attachment {
  id: string
  url: string
  name: string
  size: number
  createdAt: string
}

export interface Task {
  id: string
  title: string
  order?: number
  content?: string | null
  points?: number | null
  aiModelTag?: string | null
  dueDate?: string | null
  cover?: string | null
  columnId?: string
  members?: TaskMember[]
  labels?: TaskLabel[]
  checklist?: ChecklistItem[]
  attachments?: Attachment[]
  _count?: { checklist?: number; attachments?: number; comments?: number }
  comments?: unknown[]
}
```

- [ ] Commit:
```bash
git add prisma/ scripts/ src/types/
git commit -m "feat: add task features schema (members, labels, checklist, attachments, due date, cover)"
```

---

## Chunk 2: API — Tasks & Members

### Task 4: Update GET/PATCH /api/tasks/[taskId]

**Files:**
- Modify: `src/app/api/tasks/[taskId]/route.ts`

- [ ] Update `GET` include to add all new relations:
```ts
include: {
  members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  labels: { include: { label: true } },
  checklist: { orderBy: { order: 'asc' } },
  attachments: { orderBy: { createdAt: 'asc' } },
  comments: {
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  },
  column: { select: { id: true, name: true, boardId: true } },
}
```

- [ ] Update `PATCH` to handle `dueDate` and `cover`, remove `assigneeId`:
```ts
const { title, content, points, aiModelTag, dueDate, cover } = body
const task = await prisma.task.update({
  where: { id: taskId },
  data: {
    ...(title !== undefined && { title }),
    ...(content !== undefined && { content }),
    ...(points !== undefined && { points }),
    ...(aiModelTag !== undefined && { aiModelTag }),
    ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    ...(cover !== undefined && { cover }),
  },
  include: {
    members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    labels: { include: { label: true } },
    checklist: { orderBy: { order: 'asc' } },
    attachments: { orderBy: { createdAt: 'asc' } },
  },
})
return NextResponse.json(task)
```

### Task 5: Update POST /api/tasks (create task)

**Files:**
- Modify: `src/app/api/tasks/route.ts`

- [ ] Remove `assigneeId` from body destructuring and `prisma.task.create` data
- [ ] Update include to use `members` instead of `assignee`:
```ts
include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } }
```

### Task 6: Task members API

**Files:**
- Create: `src/app/api/tasks/[taskId]/members/route.ts`
- Create: `src/app/api/tasks/[taskId]/members/[userId]/route.ts`

- [ ] Create `src/app/api/tasks/[taskId]/members/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestUserId = request.headers.get('x-user-id')
  if (!requestUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const { userId } = await request.json()
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const member = await prisma.taskMember.upsert({
    where: { taskId_userId: { taskId, userId } },
    create: { taskId, userId },
    update: {},
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(member, { status: 201 })
}
```

- [ ] Create `src/app/api/tasks/[taskId]/members/[userId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; userId: string }> }
) {
  const requestUserId = request.headers.get('x-user-id')
  if (!requestUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId, userId } = await params
  await prisma.taskMember.delete({ where: { taskId_userId: { taskId, userId } } })
  return NextResponse.json({ ok: true })
}
```

- [ ] Commit:
```bash
git add src/app/api/tasks/
git commit -m "feat: update tasks API for new schema, add members endpoints"
```

---

## Chunk 3: API — Labels, Checklist, Attachments

### Task 7: Labels API

**Files:**
- Create: `src/app/api/boards/[boardId]/labels/route.ts`
- Create: `src/app/api/boards/[boardId]/labels/[labelId]/route.ts`
- Create: `src/app/api/tasks/[taskId]/labels/[labelId]/route.ts`

- [ ] Create `src/app/api/boards/[boardId]/labels/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const labels = await prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } })
  return NextResponse.json(labels)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const { name, color } = await request.json()
  if (!name?.trim() || !color) return NextResponse.json({ error: 'name and color required' }, { status: 400 })
  const label = await prisma.label.create({ data: { name: name.trim(), color, boardId } })
  return NextResponse.json(label, { status: 201 })
}
```

- [ ] Create `src/app/api/boards/[boardId]/labels/[labelId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; labelId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { labelId } = await params
  const { name, color } = await request.json()
  const label = await prisma.label.update({
    where: { id: labelId },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(color && { color }),
    },
  })
  return NextResponse.json(label)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string; labelId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { labelId } = await params
  await prisma.label.delete({ where: { id: labelId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] Create `src/app/api/tasks/[taskId]/labels/[labelId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; labelId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId, labelId } = await params
  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    create: { taskId, labelId },
    update: {},
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; labelId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId, labelId } = await params
  await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId, labelId } } })
  return NextResponse.json({ ok: true })
}
```

### Task 8: Checklist API

**Files:**
- Create: `src/app/api/tasks/[taskId]/checklist/route.ts`
- Create: `src/app/api/tasks/[taskId]/checklist/[itemId]/route.ts`

- [ ] Create `src/app/api/tasks/[taskId]/checklist/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params
  const { text } = await request.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const max = await prisma.checklistItem.aggregate({ where: { taskId }, _max: { order: true } })
  const item = await prisma.checklistItem.create({
    data: { taskId, text: text.trim(), order: (max._max.order ?? 0) + 1 },
  })
  return NextResponse.json(item, { status: 201 })
}
```

- [ ] Create `src/app/api/tasks/[taskId]/checklist/[itemId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; itemId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params
  const { text, checked } = await request.json()
  const item = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(text !== undefined && { text }),
      ...(checked !== undefined && { checked }),
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; itemId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId } = await params
  await prisma.checklistItem.delete({ where: { id: itemId } })
  return NextResponse.json({ ok: true })
}
```

### Task 9: Attachments API

**Files:**
- Create: `src/app/api/tasks/[taskId]/attachments/route.ts`
- Create: `src/app/api/tasks/[taskId]/attachments/[attachmentId]/route.ts`

- [ ] Create `src/app/api/tasks/[taskId]/attachments/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadToQiniu } from '@/lib/qiniu'

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { taskId } = await params

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const { url } = await uploadToQiniu(buffer, file.name)

  const attachment = await prisma.attachment.create({
    data: { taskId, url, name: file.name, size: file.size },
  })
  return NextResponse.json(attachment, { status: 201 })
}
```

- [ ] Create `src/app/api/tasks/[taskId]/attachments/[attachmentId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; attachmentId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { attachmentId } = await params
  await prisma.attachment.delete({ where: { id: attachmentId } })
  return NextResponse.json({ ok: true })
}
```

- [ ] Commit:
```bash
git add src/app/api/
git commit -m "feat: add labels, checklist, and attachments API endpoints"
```

---

## Chunk 4: Board Page Query & TaskCard

### Task 10: Update board page query

**Files:**
- Modify: `src/app/boards/[boardId]/page.tsx`

- [ ] Update the Prisma query to include new task relations:
```ts
tasks: {
  orderBy: { order: 'asc' },
  include: {
    members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    labels: { include: { label: { select: { id: true, name: true, color: true } } } },
    _count: { select: { checklist: true, attachments: true, comments: true } },
    checklist: { where: { checked: true }, select: { id: true } },
  },
},
```

- [ ] Pass `boardId` down as a prop to `KanbanBoard` (it already receives it) — no change needed there

### Task 11: Rewrite TaskCard

**Files:**
- Modify: `src/components/board/TaskCard.tsx`

- [ ] Rewrite to show cover strip, labels, due date, checklist progress, members, attachment count:

```tsx
'use client'

import { Badge } from '@/components/ui/badge'
import UserAvatar from '@/components/shared/UserAvatar'
import { MessageSquare, Paperclip, CheckSquare } from 'lucide-react'
import type { Task } from '@/types'

interface Props {
  task: Task
  onClick: () => void
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date()
}

function isDueToday(dueDate: string) {
  const d = new Date(dueDate)
  const today = new Date()
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
}

export default function TaskCard({ task, onClick }: Props) {
  const checkedCount = task.checklist?.filter((i) => i.checked).length ?? 0
  const totalChecklist = task._count?.checklist ?? task.checklist?.length ?? 0
  const attachmentCount = task._count?.attachments ?? task.attachments?.length ?? 0
  const commentCount = task._count?.comments ?? task.comments?.length ?? 0

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card cursor-pointer shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
    >
      {/* Cover strip */}
      {task.cover && (
        <div className="h-8 w-full shrink-0" style={{ backgroundColor: task.cover }} />
      )}

      <div className="flex flex-col gap-2 p-3">
        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.map(({ label }) => (
              <span
                key={label.id}
                className="rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm font-medium leading-snug">{task.title}</p>

        {/* Badges row */}
        <div className="flex items-center gap-2 flex-wrap">
          {task.points != null && (
            <Badge variant="outline" className="text-xs">{task.points} pts</Badge>
          )}
          {task.aiModelTag && (
            <Badge variant="secondary" className="text-xs">{task.aiModelTag}</Badge>
          )}
          {task.dueDate && (
            <Badge
              variant="outline"
              className={`text-xs ${
                isOverdue(task.dueDate)
                  ? 'border-red-500 bg-red-50 text-red-600'
                  : isDueToday(task.dueDate)
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-600'
                  : ''
              }`}
            >
              {new Date(task.dueDate).toLocaleDateString()}
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {totalChecklist > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare size={12} />
              {checkedCount}/{totalChecklist}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip size={12} />
              {attachmentCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={12} />
              {commentCount}
            </span>
          )}
          {/* Member avatars */}
          {task.members && task.members.length > 0 && (
            <div className="ml-auto flex items-center -space-x-1">
              {task.members.slice(0, 3).map(({ user }) => (
                <UserAvatar key={user.id} name={user.name} avatarUrl={user.avatarUrl} size="sm" />
              ))}
              {task.members.length > 3 && (
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs">
                  +{task.members.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] Commit:
```bash
git add src/app/boards/ src/components/board/TaskCard.tsx
git commit -m "feat: update board query and TaskCard for new task features"
```

---

## Chunk 5: TaskDetailDialog Redesign

### Task 12: Rewrite TaskDetailDialog

**Files:**
- Modify: `src/components/board/TaskDetailDialog.tsx`

The dialog becomes a single-column Trello-style layout. Each feature section is self-contained.

- [ ] Update the `Task` interface at the top of the file to match `src/types/index.ts` (import from types or redefine locally):
```ts
import type { Task, ChecklistItem, Attachment } from '@/types'
```

- [ ] Add state for all new features:
```ts
const [members, setMembers] = useState<Task['members']>([])
const [labels, setLabels] = useState<Task['labels']>([])
const [checklist, setChecklist] = useState<ChecklistItem[]>([])
const [attachments, setAttachments] = useState<Attachment[]>([])
const [dueDate, setDueDate] = useState<string>('')
const [cover, setCover] = useState<string>('')
const [boardMembers, setBoardMembers] = useState<{ id: string; name: string; avatarUrl?: string | null }[]>([])
const [boardLabels, setBoardLabels] = useState<{ id: string; name: string; color: string }[]>([])
const [newChecklistItem, setNewChecklistItem] = useState('')
const [memberPickerOpen, setMemberPickerOpen] = useState(false)
const [labelPickerOpen, setLabelPickerOpen] = useState(false)
```

- [ ] Update `useEffect` to hydrate all new state from fetched task:
```ts
useEffect(() => {
  if (!taskId || !open) return
  setLoading(true)
  fetch(`/api/tasks/${taskId}`)
    .then((r) => r.json())
    .then((t) => {
      setTask(t)
      setTitle(t.title)
      setContent(t.content ?? '')
      setPoints(t.points?.toString() ?? '')
      setAiModelTag(t.aiModelTag ?? '')
      setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '')
      setCover(t.cover ?? '')
      setMembers(t.members ?? [])
      setLabels(t.labels ?? [])
      setChecklist(t.checklist ?? [])
      setAttachments(t.attachments ?? [])
    })
    .finally(() => setLoading(false))
}, [taskId, open])
```

- [ ] Fetch board members and board labels when task loads (need `boardId` from `column.boardId`):
```ts
// Inside the .then() after fetching task:
if (t.column?.boardId) {
  Promise.all([
    fetch(`/api/boards/${t.column.boardId}/members`).then((r) => r.json()),
    fetch(`/api/boards/${t.column.boardId}/labels`).then((r) => r.json()),
  ]).then(([bm, bl]) => {
    setBoardMembers(bm.map((m: { user: { id: string; name: string; avatarUrl?: string | null } }) => m.user))
    setBoardLabels(bl)
  })
}
```

  > Note: `GET /api/boards/[boardId]/members` already exists (check `src/app/api/boards/[boardId]/members/route.ts` — if not, use the org members endpoint or add it). The board page already loads board members via the join table; use `/api/boards/[boardId]` which returns members via board's `members` relation. Adjust as needed.

- [ ] Update `handleSave` to include `dueDate` and `cover`:
```ts
body: JSON.stringify({
  title,
  content,
  points: points ? parseInt(points) : null,
  aiModelTag: aiModelTag || null,
  dueDate: dueDate || null,
  cover: cover || null,
}),
```

- [ ] Add member toggle handler:
```ts
async function toggleMember(user: { id: string; name: string; avatarUrl?: string | null }) {
  const isMember = members?.some((m) => m.user.id === user.id)
  if (isMember) {
    await fetch(`/api/tasks/${task!.id}/members/${user.id}`, { method: 'DELETE' })
    setMembers((prev) => prev?.filter((m) => m.user.id !== user.id))
  } else {
    await fetch(`/api/tasks/${task!.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    setMembers((prev) => [...(prev ?? []), { user }])
  }
}
```

- [ ] Add label toggle handler:
```ts
async function toggleLabel(label: { id: string; name: string; color: string }) {
  const hasLabel = labels?.some((l) => l.label.id === label.id)
  if (hasLabel) {
    await fetch(`/api/tasks/${task!.id}/labels/${label.id}`, { method: 'DELETE' })
    setLabels((prev) => prev?.filter((l) => l.label.id !== label.id))
  } else {
    await fetch(`/api/tasks/${task!.id}/labels/${label.id}`, { method: 'POST' })
    setLabels((prev) => [...(prev ?? []), { label }])
  }
}
```

- [ ] Add checklist handlers:
```ts
async function addChecklistItem() {
  if (!newChecklistItem.trim() || !task) return
  const res = await fetch(`/api/tasks/${task.id}/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: newChecklistItem }),
  })
  const item = await res.json()
  setChecklist((prev) => [...prev, item])
  setNewChecklistItem('')
}

async function toggleChecklistItem(itemId: string, checked: boolean) {
  await fetch(`/api/tasks/${task!.id}/checklist/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked }),
  })
  setChecklist((prev) => prev.map((i) => i.id === itemId ? { ...i, checked } : i))
}

async function deleteChecklistItem(itemId: string) {
  await fetch(`/api/tasks/${task!.id}/checklist/${itemId}`, { method: 'DELETE' })
  setChecklist((prev) => prev.filter((i) => i.id !== itemId))
}
```

- [ ] Add attachment handlers:
```ts
async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file || !task) return
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`/api/tasks/${task.id}/attachments`, { method: 'POST', body: formData })
  if (!res.ok) { toast.error('Upload failed'); return }
  const attachment = await res.json()
  setAttachments((prev) => [...prev, attachment])
}

async function deleteAttachment(attachmentId: string) {
  await fetch(`/api/tasks/${task!.id}/attachments/${attachmentId}`, { method: 'DELETE' })
  setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
}
```

- [ ] Replace the dialog content JSX with the new single-column layout:

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="w-[90vw] max-w-2xl max-h-[90vh] overflow-y-auto">
    {loading ? (
      <div className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-48 w-full" />
      </div>
    ) : task ? (
      <>
        {/* Cover */}
        {cover && (
          <div className="h-16 rounded-t-lg -mx-6 -mt-6 mb-2" style={{ backgroundColor: cover }} />
        )}

        <DialogHeader>
          <DialogTitle>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSave}
              className="text-lg font-bold border-none shadow-none px-0 focus-visible:ring-0"
            />
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Members */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Members</span>
            <div className="flex flex-wrap items-center gap-2">
              {members?.map(({ user }) => (
                <button key={user.id} onClick={() => toggleMember(user)} title={`Remove ${user.name}`} className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs hover:bg-destructive/10 transition-colors">
                  <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                  {user.name}
                </button>
              ))}
              {/* Member picker */}
              <div className="relative">
                <button
                  onClick={() => setMemberPickerOpen((v) => !v)}
                  className="flex size-7 items-center justify-center rounded-full border border-dashed hover:bg-accent transition-colors"
                >
                  <Plus size={14} />
                </button>
                {memberPickerOpen && (
                  <div className="absolute left-0 top-8 z-50 w-48 rounded-md border bg-popover shadow-md p-1">
                    {boardMembers.filter((u) => !members?.some((m) => m.user.id === u.id)).map((user) => (
                      <button key={user.id} onClick={() => { toggleMember(user); setMemberPickerOpen(false) }}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
                        {user.name}
                      </button>
                    ))}
                    {boardMembers.filter((u) => !members?.some((m) => m.user.id === u.id)).length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">All members assigned</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Labels */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Labels</span>
            <div className="flex flex-wrap items-center gap-2">
              {labels?.map(({ label }) => (
                <button key={label.id} onClick={() => toggleLabel(label)}
                  className="rounded px-2 py-0.5 text-xs font-medium text-white hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: label.color }}>
                  {label.name} ×
                </button>
              ))}
              <div className="relative">
                <button onClick={() => setLabelPickerOpen((v) => !v)}
                  className="flex size-7 items-center justify-center rounded-full border border-dashed hover:bg-accent transition-colors">
                  <Plus size={14} />
                </button>
                {labelPickerOpen && (
                  <div className="absolute left-0 top-8 z-50 w-52 rounded-md border bg-popover shadow-md p-2 flex flex-col gap-1">
                    {boardLabels.map((label) => (
                      <button key={label.id} onClick={() => { toggleLabel(label); setLabelPickerOpen(false) }}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                        <span className="size-4 rounded shrink-0" style={{ backgroundColor: label.color }} />
                        {label.name}
                        {labels?.some((l) => l.label.id === label.id) && <Check size={12} className="ml-auto" />}
                      </button>
                    ))}
                    <NewLabelForm boardId={task.column!.boardId} onCreated={(label) => {
                      setBoardLabels((prev) => [...prev, label])
                      setLabelPickerOpen(false)
                    }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Due date & Cover row */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); setTimeout(handleSave, 0) }}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cover</span>
              <div className="flex items-center gap-1">
                {['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280'].map((c) => (
                  <button key={c} onClick={() => { setCover(cover === c ? '' : c); setTimeout(handleSave, 0) }}
                    className={`size-6 rounded transition-transform ${cover === c ? 'ring-2 ring-offset-1 ring-foreground scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
                {cover && (
                  <button onClick={() => { setCover(''); setTimeout(handleSave, 0) }}
                    className="text-xs text-muted-foreground hover:text-foreground ml-1">clear</button>
                )}
              </div>
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Story Points</Label>
              <Input type="number" value={points} onChange={(e) => setPoints(e.target.value)} onBlur={handleSave} placeholder="0" className="h-8 w-24 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">AI Model</Label>
              <Input value={aiModelTag} onChange={(e) => setAiModelTag(e.target.value)} onBlur={handleSave} placeholder="claude-opus-4" className="h-8 w-36 text-sm" />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</span>
            <MarkdownEditor value={content} onChange={setContent} onBlur={handleSave} placeholder="Add description..." height={300} />
          </div>

          {/* Checklist */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Checklist {checklist.length > 0 && `(${checklist.filter((i) => i.checked).length}/${checklist.length})`}
              </span>
            </div>
            {checklist.length > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${(checklist.filter((i) => i.checked).length / checklist.length) * 100}%` }}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <input type="checkbox" checked={item.checked}
                    onChange={(e) => toggleChecklistItem(item.id, e.target.checked)}
                    className="size-4 rounded accent-green-500 cursor-pointer" />
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                  <button onClick={() => deleteChecklistItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                placeholder="Add an item..."
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addChecklistItem}>Add</Button>
            </div>
          </div>

          {/* Attachments */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attachments</span>
            {attachments.length > 0 && (
              <div className="flex flex-col gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-md border p-2 group">
                    <Paperclip size={14} className="shrink-0 text-muted-foreground" />
                    <a href={a.url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-sm truncate hover:underline">{a.name}</a>
                    <span className="text-xs text-muted-foreground shrink-0">{(a.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => deleteAttachment(a.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={handleAttachmentUpload} />
              <span className="flex w-fit items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors">
                <Paperclip size={14} /> Add attachment
              </span>
            </label>
          </div>

          <Separator />

          {/* Comments */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comments</h4>
            {task.comments?.map((c) => (
              <div key={c.id} className="flex gap-3">
                <UserAvatar name={c.author.name} avatarUrl={c.author.avatarUrl} size="sm" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">{c.author.name}</span>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..."
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleComment() }} />
              <Button size="icon" variant="ghost" onClick={handleComment}><Send size={16} /></Button>
            </div>
          </div>
        </div>
      </>
    ) : null}
  </DialogContent>
</Dialog>
```

- [ ] Add a small `NewLabelForm` component inline (below `boardLabels.map(...)` in the label picker):
```tsx
function NewLabelForm({ boardId, onCreated }: { boardId: string; onCreated: (label: { id: string; name: string; color: string }) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')

  async function create() {
    if (!name.trim()) return
    const res = await fetch(`/api/boards/${boardId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
    const label = await res.json()
    onCreated(label)
    setName('')
  }

  return (
    <div className="border-t mt-1 pt-2 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground px-1">New label</p>
      <div className="flex gap-1">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-7 cursor-pointer rounded border" />
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create() }} placeholder="Label name" className="h-7 text-xs flex-1" />
        <Button size="sm" className="h-7 px-2 text-xs" onClick={create}>+</Button>
      </div>
    </div>
  )
}
```

- [ ] Update imports at top of file:
```ts
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import MarkdownEditor from '@/components/editor/MarkdownEditor'
import UserAvatar from '@/components/shared/UserAvatar'
import { toast } from 'sonner'
import { Send, Plus, Check, X, Paperclip } from 'lucide-react'
import type { Task, ChecklistItem, Attachment } from '@/types'
```

- [ ] Check that a board members endpoint exists. Look for `src/app/api/boards/[boardId]/members/route.ts`. If missing, create it:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { boardId } = await params
  const members = await prisma.boardMember.findMany({
    where: { boardId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  })
  return NextResponse.json(members)
}
```

- [ ] Build to verify no TS errors:
```bash
bun run build
```
Expected: `✓ Compiled successfully`

- [ ] Commit:
```bash
git add src/
git commit -m "feat: Trello-style TaskDetailDialog with members, labels, checklist, attachments, cover, due date"
```

---

## Chunk 6: Final Wiring & Cleanup

### Task 13: Update KanbanBoard to pass boardId to board members fetch

**Files:**
- Modify: `src/components/board/KanbanBoard.tsx`

- [ ] `TaskDetailDialog` already receives `taskId` and fetches `column.boardId` internally — no change needed to `KanbanBoard`. Verify that `GET /api/tasks/[taskId]` includes `column: { select: { id, name, boardId } }` (already in Task 4). ✓

### Task 14: Verify build & acp

- [ ] Run full build:
```bash
bun run build 2>&1 | grep -E "(error|Error|Failed)"
```
Expected: no output (clean build).

- [ ] Commit and push:
```bash
git add -A
git commit -m "feat: complete Trello task features — members, labels, checklist, attachments, cover, due date"
git push
```
