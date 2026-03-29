'use client'

import { useEffect } from 'react'

// Paths that must always hit the local server (auth is local even in dev-online mode)
const LOCAL_PATHS = ['/api/auth/']

export function ApiBaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apiBase = (window as { __OPC_API_BASE__?: string }).__OPC_API_BASE__ ?? ''
    if (!apiBase) return
    const original = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (
        typeof input === 'string' &&
        (input.startsWith('/api/') || input.startsWith('/oauth/')) &&
        !LOCAL_PATHS.some((p) => (input as string).startsWith(p))
      ) {
        input = apiBase + input
      }
      return original(input, init)
    }
    return () => { window.fetch = original }
  }, [])
  return <>{children}</>
}
