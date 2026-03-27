export interface TaskMemberUser {
  id: string
  name: string
  avatarUrl?: string | null
}

export interface TaskMember {
  user: TaskMemberUser
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
  folderPath?: string | null
  columnId?: string
  column?: { id: string; name: string; boardId: string } | null
  members?: TaskMember[]
  labels?: TaskLabel[]
  checklist?: ChecklistItem[]
  attachments?: Attachment[]
  _count?: { checklist?: number; attachments?: number; comments?: number }
  comments?: unknown[]
}

export interface BoardFilters {
  labelIds: string[]
  userIds: string[]
  due: 'overdue' | 'today' | 'upcoming' | 'none' | null
}

export interface SessionPayload {
  sub: string // user.id
  iat?: number
  exp?: number
}

export interface UserInfo {
  id: string
  nickname: string
  email?: string
  avatar_url?: string
}

export interface Org {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface OrgMember {
  id: string
  role: string
  userId: string
  orgId: string
  user: { id: string; name: string; avatarUrl?: string | null }
}

export interface OrgInvite {
  id: string
  token: string
  orgId: string
  createdBy: string
  expiresAt?: string | null
  createdAt: string
}
