import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PublicDocView from './PublicDocView'

export default async function PublicDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = await prisma.doc.findUnique({
    where: { slug },
    select: { id: true, title: true, content: true, publicAccess: true },
  })
  if (!doc || !doc.publicAccess) redirect('/404')
  return <PublicDocView doc={doc as { id: string; title: string; content: string | null; publicAccess: string }} slug={slug} />
}
