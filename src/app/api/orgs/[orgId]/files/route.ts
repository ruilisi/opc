import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { uploadToQiniu } from '@/lib/qiniu'
import { emitOrgFileEvent } from '@/lib/realtime'

const FILE_SIZE_LIMIT = 100 * 1024 * 1024 // 100 MB

const fileInclude = {
  uploader: { select: { id: true, name: true, avatarUrl: true } },
  tags: { include: { tag: true } },
} as const

async function getMembership(orgId: string, userId: string) {
  return prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await getMembership(orgId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const folderId = searchParams.get('folderId')
  const search = searchParams.get('search')
  const tagIds = searchParams.getAll('tagId')

  const VALID_SORTS = ['name', 'size', 'createdAt'] as const
  type SortField = (typeof VALID_SORTS)[number]
  const rawSort = searchParams.get('sort') ?? 'createdAt'
  const sort: SortField = (VALID_SORTS as readonly string[]).includes(rawSort) ? (rawSort as SortField) : 'createdAt'
  const rawOrder = searchParams.get('order') ?? 'desc'
  const order: 'asc' | 'desc' = rawOrder === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = { orgId }
  if (!search) {
    if (folderId && folderId !== 'all') where.folderId = folderId === 'root' ? null : folderId
  }
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (tagIds.length > 0) {
    where.tags = { some: { tagId: { in: tagIds } } }
    // AND: all tags must be present — filter post-query
  }

  let files = await prisma.orgFile.findMany({
    where,
    include: fileInclude,
    orderBy: { [sort]: order },
  })

  // AND filter for multiple tags
  if (tagIds.length > 1) {
    files = files.filter((f) =>
      tagIds.every((tid) => f.tags.some((t) => t.tagId === tid))
    )
  }

  return NextResponse.json({ files })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await getMembership(orgId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  if (member.role === 'viewer') return NextResponse.json({ error: 'Permission denied', code: 'PERMISSION_DENIED' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (file.size > FILE_SIZE_LIMIT) return NextResponse.json({ error: 'File too large', code: 'FILE_TOO_LARGE' }, { status: 413 })

  const folderIdRaw = formData.get('folderId') as string | null
  const folderId = folderIdRaw || null

  // Validate folder belongs to org
  if (folderId) {
    const folder = await prisma.orgFolder.findUnique({ where: { id: folderId }, select: { orgId: true } })
    if (!folder || folder.orgId !== orgId) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let uploadResult: { url: string; key: string }
  try {
    uploadResult = await uploadToQiniu(buffer, file.name)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const code = message.includes('not configured') ? 'STORAGE_UNCONFIGURED' : 'UPLOAD_FAILED'
    return NextResponse.json({ error: message, code }, { status: 503 })
  }

  const orgFile = await prisma.orgFile.create({
    data: {
      name: file.name,
      url: uploadResult.url,
      key: uploadResult.key,
      size: file.size,
      mimeType: file.type.toLowerCase() || 'application/octet-stream',
      orgId,
      folderId,
      uploaderId: userId,
    },
    include: fileInclude,
  })

  emitOrgFileEvent(orgId, { type: 'file.uploaded', payload: orgFile })
  return NextResponse.json(orgFile, { status: 201 })
}
