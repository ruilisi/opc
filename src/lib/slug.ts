import { prisma } from '@/lib/prisma'

/**
 * Generate a unique random slug of `length` chars (a-z0-9).
 * Checks for uniqueness against the given Prisma finder.
 */
export async function generateUniqueSlug(
  length: number,
  isUnique: (slug: string) => Promise<boolean>
): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  while (true) {
    const slug = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    if (await isUnique(slug)) return slug
  }
}

export async function generateFormSlug(): Promise<string> {
  return generateUniqueSlug(5, async (slug) => {
    const existing = await prisma.boardForm.findUnique({ where: { slug } })
    return !existing
  })
}

export async function generateDocSlug(): Promise<string> {
  return generateUniqueSlug(5, async (slug) => {
    const existing = await prisma.doc.findUnique({ where: { slug } })
    return !existing
  })
}
