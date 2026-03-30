'use client'

import { useEffect } from 'react'

export function ApiBaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const original = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      return original(input, init).then((res) => {
        return res
      })
    }
    return () => { window.fetch = original }
  }, [])
  return <>{children}</>
}
