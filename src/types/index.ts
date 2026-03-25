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
