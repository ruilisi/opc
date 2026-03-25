import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const setting = await prisma.appSetting.findUnique({ where: { key: 'qiniu' } })
  if (!setting) return NextResponse.json(null)
  return NextResponse.json(JSON.parse(setting.value))
}

export async function PUT(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const setting = await prisma.appSetting.upsert({
    where: { key: 'qiniu' },
    update: { value: JSON.stringify(body) },
    create: { key: 'qiniu', value: JSON.stringify(body) },
  })
  return NextResponse.json(setting)
}
