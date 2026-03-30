'use client'

import { useEffect } from 'react'

export function ApiBaseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const original = window.fetch
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      return original(input, init).then((res) => {
        if (res.status === 401 && !window.location.pathname.startsWith('/login') && process.env.NODE_ENV === 'production') {
          window.location.href = '/login'
        }
        return res
      })
    }
    return () => { window.fetch = original }
  }, [])
  return <>{children}</>
}
