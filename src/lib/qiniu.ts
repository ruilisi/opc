import * as qiniu from 'qiniu'
import { createHash } from 'crypto'
import { extname } from 'path'
import { prisma } from '@/lib/prisma'

export async function uploadToQiniu(
  buffer: Buffer,
  originalName: string
): Promise<{ url: string; key: string }> {
  // Load from DB settings first, fall back to env vars
  const setting = await prisma.appSetting.findUnique({ where: { key: 'qiniu' } })
  const cfg = setting ? JSON.parse(setting.value) : {}

  const accessKey = cfg.accessKey || process.env.QINIU_ACCESS_KEY || ''
  const secretKey = cfg.secretKey || process.env.QINIU_SECRET_KEY || ''
  const bucket    = cfg.bucket    || process.env.QINIU_BUCKET      || ''
  const domain    = cfg.domain    || process.env.QINIU_DOMAIN      || ''
  const folder    = cfg.folder    || process.env.QINIU_FOLDER      || ''

  if (!accessKey || !secretKey || !bucket || !domain) {
    throw new Error('Qiniu is not configured. Set credentials in Settings → Qiniu Storage.')
  }

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const putPolicy = new qiniu.rs.PutPolicy({ scope: bucket })
  const uploadToken = putPolicy.uploadToken(mac)

  const ext = extname(originalName).toLowerCase() || '.bin'
  const hash = createHash('md5').update(buffer).digest('hex')
  const key = folder ? `${folder.replace(/\/$/, '')}/${hash}${ext}` : `${hash}${ext}`

  const config = new qiniu.conf.Config()
  const formUploader = new qiniu.form_up.FormUploader(config)
  const putExtra = new qiniu.form_up.PutExtra()

  return new Promise((resolve, reject) => {
    formUploader.put(uploadToken, key, buffer, putExtra, (err, _body, info) => {
      if (err || info.statusCode !== 200) {
        reject(err ?? new Error(`Upload failed: ${info.statusCode}`))
        return
      }
      resolve({ url: `https://${domain}/${key}`, key })
    })
  })
}

export async function deleteFromQiniu(key: string): Promise<void> {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'qiniu' } })
  const cfg = setting ? JSON.parse(setting.value) : {}

  const accessKey = cfg.accessKey || process.env.QINIU_ACCESS_KEY || ''
  const secretKey = cfg.secretKey || process.env.QINIU_SECRET_KEY || ''
  const bucket    = cfg.bucket    || process.env.QINIU_BUCKET      || ''

  if (!accessKey || !secretKey || !bucket) return

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
  const config = new qiniu.conf.Config()
  const bucketManager = new qiniu.rs.BucketManager(mac, config)

  await new Promise<void>((resolve, reject) => {
    bucketManager.delete(bucket, key, (err, _body, info) => {
      if (err || (info.statusCode !== 200 && info.statusCode !== 612)) {
        // 612 = object not found (already deleted), treat as success
        reject(err ?? new Error(`Qiniu delete failed: ${info.statusCode}`))
      } else {
        resolve()
      }
    })
  })
}
