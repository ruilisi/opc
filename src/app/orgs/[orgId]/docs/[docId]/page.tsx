import { cookies } from 'next/headers'
import { COOKIE_NAME } from '@/lib/auth'
import DocEditorClient from './DocEditorClient'

export default async function DocEditorPage({ params }: { params: Promise<{ orgId: string; docId: string }> }) {
  const { orgId, docId } = await params
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? ''
  return <DocEditorClient orgId={orgId} docId={docId} token={token} />
}
