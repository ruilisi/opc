import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { verifySession } from '../src/lib/auth'

// Use a Pool so connections are managed automatically
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as never)

function randomColor(): string {
  const colors = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6']
  return colors[Math.floor(Math.random() * colors.length)]
}

const server = new Server({
  port: Number(process.env.HOCUSPOCUS_PORT ?? 1234),

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await prisma.doc.findUnique({ where: { id: documentName } })
        return doc?.ydocState ? Buffer.from(doc.ydocState) : null
      },
      store: async ({ documentName, state }) => {
        await prisma.doc.update({
          where: { id: documentName },
          data: { ydocState: Buffer.from(state), updatedAt: new Date() },
        })
      },
    }),
  ],

  async onAuthenticate({ token, documentName }) {
    // Public edit access: token = "public:<slug>"
    if (token.startsWith('public:')) {
      const slug = token.slice(7)
      const doc = await prisma.doc.findUnique({ where: { slug } })
      if (!doc || doc.id !== documentName || doc.publicAccess !== 'edit') {
        throw new Error('Forbidden')
      }
      return { userId: null, name: `Guest ${Math.floor(Math.random() * 9000) + 1000}`, color: randomColor() }
    }

    // Authenticated user
    const session = await verifySession(token)
    if (!session) throw new Error('Unauthorized')

    const doc = await prisma.doc.findUnique({ where: { id: documentName } })
    if (!doc) throw new Error('Not found')

    // Owner always has access
    if (doc.createdById === session.sub) {
      const user = await prisma.user.findUnique({ where: { id: session.sub } })
      return { userId: session.sub, name: user?.name ?? 'Unknown', color: randomColor() }
    }

    // Check explicit permission
    const perm = await prisma.docPermission.findUnique({
      where: { docId_userId: { docId: doc.id, userId: session.sub } },
    })
    if (!perm) throw new Error('Forbidden')

    const user = await prisma.user.findUnique({ where: { id: session.sub } })
    return { userId: session.sub, name: user?.name ?? 'Unknown', color: randomColor(), readOnly: perm.role === 'viewer' }
  },
})

server.listen().then(() => {
  console.log(`Hocuspocus server running on port ${process.env.HOCUSPOCUS_PORT ?? 1234}`)
})
