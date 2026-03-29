'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { OrgFile } from '@/types'
import { getFileCategory } from './FileIcon'
import { useT } from '@/lib/i18n'

interface Props {
  file: OrgFile | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function FilePreviewModal({ file, open, onOpenChange }: Props) {
  const { t } = useT()
  const [textContent, setTextContent] = useState<string | null>(null)

  useEffect(() => {
    if (!file || !open) {
      setTextContent(null)
      return
    }
    const category = getFileCategory(file.mimeType)
    if (category !== 'code') return
    fetch(file.url)
      .then((r) => r.text())
      .then(setTextContent)
      .catch(() => setTextContent(null))
  }, [file, open])

  if (!file) return null
  const category = getFileCategory(file.mimeType)

  function renderPreview() {
    if (!file) return null
    switch (category) {
      case 'pdf':
        return <iframe src={file.url} className="w-full h-[70vh] rounded border" title={file.name} />
      case 'image':
        return <img src={file.url} alt={file.name} className="max-h-[70vh] max-w-full mx-auto rounded object-contain" />
      case 'video':
        return <video src={file.url} controls className="max-h-[70vh] w-full rounded" />
      case 'audio':
        return (
          <div className="flex flex-col items-center gap-4 py-8">
            <audio src={file.url} controls className="w-full" />
          </div>
        )
      case 'code':
        return textContent !== null
          ? <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-4 text-xs">{textContent}</pre>
          : <p className="text-muted-foreground text-sm">Loading...</p>
      default:
        return (
          <div className="flex flex-col items-center gap-4 py-12 text-muted-foreground">
            <p className="text-sm">{t('files_no_preview')}</p>
            <Button variant="outline" onClick={() => { window.open(file.url, '_blank') }}>
              <Download size={14} className="mr-2" />{t('files_download_instead')}
            </Button>
          </div>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
        </DialogHeader>
        {renderPreview()}
      </DialogContent>
    </Dialog>
  )
}
