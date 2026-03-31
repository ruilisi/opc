import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function ShortLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const form = await prisma.boardForm.findUnique({ where: { slug } })
  if (!form) redirect('/404')
  redirect(`/forms/${form.id}`)
}
