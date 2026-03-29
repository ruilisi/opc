import { FileText, Image, Video, Music, Table2, Presentation, FileCode, Archive, File } from 'lucide-react'

interface Props {
  mimeType: string
  size?: number
  className?: string
}

export function getFileCategory(mimeType: string) {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation'
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'document'
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) return 'code'
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip') || mimeType.includes('7z')) return 'archive'
  return 'file'
}

export default function FileIcon({ mimeType, size = 20, className = '' }: Props) {
  const category = getFileCategory(mimeType)
  const props = { size, className }

  switch (category) {
    case 'pdf':          return <div className={`flex items-center justify-center rounded text-[10px] font-bold text-white bg-red-500 ${className}`} style={{ width: size, height: size }}>PDF</div>
    case 'image':        return <Image {...props} className={`text-emerald-500 ${className}`} />
    case 'video':        return <Video {...props} className={`text-blue-500 ${className}`} />
    case 'audio':        return <Music {...props} className={`text-purple-500 ${className}`} />
    case 'spreadsheet':  return <Table2 {...props} className={`text-green-600 ${className}`} />
    case 'presentation': return <Presentation {...props} className={`text-orange-500 ${className}`} />
    case 'document':     return <FileText {...props} className={`text-blue-600 ${className}`} />
    case 'code':         return <FileCode {...props} className={`text-muted-foreground ${className}`} />
    case 'archive':      return <Archive {...props} className={`text-amber-700 ${className}`} />
    default:             return <File {...props} className={`text-muted-foreground ${className}`} />
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
