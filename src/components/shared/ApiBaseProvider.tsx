'use client'

import { useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ''

export function ApiBaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!API_BASE) return
    const original = window.fetch
    window.fetch = (input, init) => {
      if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('/oauth/'))) {
        input = API_BASE + input
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [])
  return <>{children}</>
}
