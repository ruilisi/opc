import { SignJWT, jwtVerify } from 'jose'
import type { SessionPayload } from '@/types'

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-must-change')
const COOKIE_NAME = 'opc_session'
const EXPIRY_SECONDS = 30 * 24 * 60 * 60 // 30 days

export { COOKIE_NAME }

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(secret)
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as SessionPayload
  } catch {
    return null
  }
}
