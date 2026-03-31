'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

interface FormField {
  id: string
  label: string
  type: string
  required: boolean
  options: string | null
}

interface PublicForm {
  id: string
  title: string
  description: string | null
  fields: FormField[]
}

export default function PublicFormPage() {
  const { formId } = useParams<{ formId: string }>()
  const [form, setForm] = useState<PublicForm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/forms/${formId}`)
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json()
          setError(d.error ?? 'This form is unavailable')
          return
        }
        const data = await r.json()
        setForm(data)
        const init: Record<string, string> = {}
        data.fields.forEach((f: FormField) => { init[f.id] = '' })
        setValues(init)
      })
      .finally(() => setLoading(false))
  }, [formId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/forms/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const d = await res.json()
        toast.error(d.error ?? 'Submission failed')
        return
      }
      setSubmitted(true)
    } catch {
      toast.error('Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        {loading ? (
          <div className="text-center text-muted-foreground">Loading form…</div>
        ) : error ? (
          <div className="rounded-xl border p-8 text-center">
            <p className="text-lg font-semibold text-destructive">{error}</p>
          </div>
        ) : submitted ? (
          <div className="rounded-xl border p-8 text-center flex flex-col items-center gap-3">
            <CheckCircle2 size={40} className="text-green-500" />
            <p className="text-xl font-semibold">Submitted!</p>
            <p className="text-muted-foreground text-sm">Your response has been recorded. Thank you!</p>
            <Button variant="outline" size="sm" onClick={() => { setSubmitted(false); setValues(Object.fromEntries(form!.fields.map((f) => [f.id, '']))) }}>
              Submit another
            </Button>
          </div>
        ) : form ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold">{form.title}</h1>
              {form.description && <p className="text-muted-foreground">{form.description}</p>}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {form.fields.map((field) => (
                <div key={field.id} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={values[field.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                      required={field.required}
                      rows={4}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={values[field.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                      required={field.required}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select…</option>
                      {(field.options ?? '').split(',').map((o) => o.trim()).filter(Boolean).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type}
                      value={values[field.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                      required={field.required}
                    />
                  )}
                </div>
              ))}
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  )
}
