'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/shared/AppShell'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Download, ArrowLeft, ExternalLink } from 'lucide-react'

interface FormField { id: string; label: string; type: string }
interface Submission {
  id: string
  data: Record<string, string>
  createdAt: string
  task: { id: string; title: string; column: { boardId: string } } | null
}

export default function SubmissionsPage() {
  const { boardId, formId } = useParams<{ boardId: string; formId: string }>()
  const router = useRouter()
  const [fields, setFields] = useState<FormField[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/boards/${boardId}/forms/${formId}/submissions`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) { setFields(d.fields); setSubmissions(d.submissions) }
      })
      .finally(() => setLoading(false))
  }, [boardId, formId])

  function handleExport() {
    window.location.href = `/api/boards/${boardId}/forms/${formId}/submissions?export=csv`
    toast.success('Downloading CSV…')
  }

  return (
    <AppShell>
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/boards/${boardId}/forms/${formId}`)}>
            <ArrowLeft size={15} />
          </Button>
          <h1 className="text-xl font-bold flex-1">Submissions</h1>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download size={13} className="mr-1" /> Export CSV
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">Submitted</th>
                  {fields.map((f) => (
                    <th key={f.id} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Task</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    {fields.map((f) => (
                      <td key={f.id} className="px-3 py-2 max-w-48 truncate">{s.data[f.id] ?? '—'}</td>
                    ))}
                    <td className="px-3 py-2">
                      {s.task ? (
                        <a
                          href={`/boards/${s.task.column.boardId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {s.task.title} <ExternalLink size={11} />
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
