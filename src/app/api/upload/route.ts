import { NextRequest, NextResponse } from 'next/server'
import { uploadToQiniu } from '@/lib/qiniu'

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const { url } = await uploadToQiniu(buffer, file.name)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
