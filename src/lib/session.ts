import { cookies } from 'next/headers'
import { verifySession, COOKIE_NAME } from './auth'
import type { SessionPayload } from '@/types'

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySession(token)
}
