/**
 * Data migration: create personal orgs for existing users and assign orphan boards.
 * Run after add_org_type migration and before board_orgid_required migration.
 *
 * Usage: bunx tsx scripts/migrate-personal-orgs.ts
 */

import { PrismaClient } from '../src/generated/prisma/client'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/opc_development' })

async function getSlug(prisma: PrismaClient, base: string, userId: string): Promise<string> {
  const candidates = [base, `${base}${userId.slice(-8)}`, `personal-${userId}`]
  for (const slug of candidates) {
    const existing = await prisma.organization.findUnique({ where: { slug } })
    if (!existing) return slug
  }
  return `personal-${userId}`
}

async function main() {
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const users = await prisma.user.findMany()
  console.log(`Processing ${users.length} users...`)

  for (const user of users) {
    // Check if already has personal org
    const hasPersonal = await prisma.orgMember.findFirst({
      where: { userId: user.id, role: 'owner', org: { type: 'personal' } },
    })
    if (hasPersonal) {
      console.log(`  User ${user.name}: already has personal org, skipping`)
      continue
    }

    const baseSlug = `personal-${user.id.slice(-6)}`
    const slug = await getSlug(prisma, baseSlug, user.id)

    const personalOrg = await prisma.organization.create({
      data: {
        type: 'personal',
        name: user.name,
        slug,
        members: { create: { userId: user.id, role: 'owner' } },
      },
    })
    console.log(`  User ${user.name}: created personal org ${personalOrg.id} (${slug})`)

    // Find orphan boards owned by this user
    const orphanBoards = await prisma.board.findMany({
      where: {
        orgId: null,
        members: { some: { userId: user.id, role: 'owner' } },
      },
    })

    if (orphanBoards.length > 0) {
      await prisma.board.updateMany({
        where: { id: { in: orphanBoards.map((b) => b.id) } },
        data: { orgId: personalOrg.id },
      })
      console.log(`    Assigned ${orphanBoards.length} orphan boards to personal org`)
    }
  }

  // Confirm no null orgIds remain
  const remaining = await prisma.board.count({ where: { orgId: null } })
  console.log(`\nDone. Boards with null orgId remaining: ${remaining}`)
  if (remaining > 0) {
    console.error('ERROR: Still have boards with null orgId - do not run board_orgid_required migration yet!')
    process.exit(1)
  }

  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
