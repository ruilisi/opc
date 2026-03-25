import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/opc_development' })

async function main() {
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const tasks = await prisma.task.findMany({ where: { assigneeId: { not: null } } })
  console.log(`Migrating ${tasks.length} tasks with assigneeId...`)

  for (const task of tasks) {
    if (!task.assigneeId) continue
    await prisma.taskMember.upsert({
      where: { taskId_userId: { taskId: task.id, userId: task.assigneeId } },
      create: { taskId: task.id, userId: task.assigneeId },
      update: {},
    })
  }

  console.log('Done.')
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
