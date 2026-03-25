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
