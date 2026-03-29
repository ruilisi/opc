'use client'

import type { OrgFileTag } from '@/types'

interface Props {
  tags: OrgFileTag[]
  selected: string[]
  onToggle: (tagId: string) => void
}

export default function TagFilterBar({ tags, selected, onToggle }: Props) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const active = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${active ? 'text-white ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100'}`}
            style={{ backgroundColor: active ? tag.color : tag.color + '33', color: active ? '#fff' : tag.color }}
          >
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
