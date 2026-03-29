'use client'

import { useEffect } from 'react'

export function ApiBaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiBase = (window as { __OPC_API_BASE__?: string }).__OPC_API_BASE__ ?? ''
    if (!apiBase) return
    const original = window.fetch
    window.fetch = (input, init) => {
      if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('/oauth/'))) {
        input = apiBase + input
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [])
  return <>{children}</>
}
