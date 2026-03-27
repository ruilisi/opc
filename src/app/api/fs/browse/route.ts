import { NextRequest, NextResponse } from 'next/server'
import { readdirSync } from 'fs'
import { resolve } from 'path'
import os from 'os'

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawPath = request.nextUrl.searchParams.get('path') || os.homedir()
  const absPath = resolve(rawPath.replace(/^~/, os.homedir()))

  try {
    const entries = readdirSync(absPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()

    // parent dir (don't go above home or root)
    const parent = absPath === '/' ? null : resolve(absPath, '..')

    return NextResponse.json({ path: absPath, parent, entries })
  } catch {
    return NextResponse.json({ error: 'Cannot read directory' }, { status: 400 })
  }
}
