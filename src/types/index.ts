export interface Task {
  id: string
  title: string
  order?: number
  content?: string | null
  points?: number | null
  aiModelTag?: string | null
  columnId?: string
  assignee?: { id: string; name: string; avatarUrl?: string | null } | null
  comments?: unknown[]
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
