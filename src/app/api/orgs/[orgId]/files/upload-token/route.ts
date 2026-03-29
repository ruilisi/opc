import { NextRequest, NextResponse } from 'next/server'
import * as qiniu from 'qiniu'
import { createHash } from 'crypto'
import { extname } from 'path'
import { prisma } from '@/lib/prisma'

async function getMembership(orgId: string, userId: string) {
  return prisma.orgMember.findUnique({ where: { orgId_userId: { orgId, userId } } })
}

async function getQiniuConfig() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'qiniu' } })
  const cfg = setting ? JSON.parse(setting.value) : {}
  return {
    accessKey: cfg.accessKey || process.env.QINIU_ACCESS_KEY || '',
    secretKey: cfg.secretKey || process.env.QINIU_SECRET_KEY || '',
    bucket:    cfg.bucket    || process.env.QINIU_BUCKET      || '',
    domain:    cfg.domain    || process.env.QINIU_DOMAIN      || '',
    folder:    cfg.folder    || process.env.QINIU_FOLDER      || '',
  }
}

// GET /api/orgs/[orgId]/files/upload-token?filename=foo.pdf&md5=<hex>
// Returns { token, key, url } for direct browser-to-Qiniu upload
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId } = await params

  const member = await getMembership(orgId, userId)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role === 'viewer') return NextResponse.json({ error: 'Permission denied' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const filename = searchParams.get('filename')
  const md5 = searchParams.get('md5') // optional: client-computed MD5 for dedup key

  if (!filename) return NextResponse.json({ error: 'filename required' }, { status: 400 })

  const cfg = await getQiniuConfig()
  if (!cfg.accessKey || !cfg.secretKey || !cfg.bucket || !cfg.domain) {
    return NextResponse.json({ error: 'Qiniu is not configured. Set credentials in Settings → Qiniu Storage.', code: 'STORAGE_UNCONFIGURED' }, { status: 503 })
  }

  const mac = new qiniu.auth.digest.Mac(cfg.accessKey, cfg.secretKey)
  // Token expires in 1 hour
  const putPolicy = new qiniu.rs.PutPolicy({ scope: cfg.bucket, expires: 3600 })
  const token = putPolicy.uploadToken(mac)

  const ext = extname(filename).toLowerCase() || '.bin'
  // Use provided md5 if available (client hashed), otherwise random key
  const hash = md5 && /^[0-9a-f]{32}$/i.test(md5) ? md5 : createHash('md5').update(filename + Date.now()).digest('hex')
  const key = cfg.folder ? `${cfg.folder.replace(/\/$/, '')}/${hash}${ext}` : `${hash}${ext}`
  const url = `https://${cfg.domain}/${key}`

  return NextResponse.json({ token, key, url })
}
