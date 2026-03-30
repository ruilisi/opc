'use client'

import { useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function OAuthCallback() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const returnPath = state ? decodeURIComponent(state) : '/boards'

    if (!code) {
      router.replace(returnPath)
      return
    }

    fetch('/api/auth/oauth-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirectUri: window.location.origin + '/oauth/callback',
      }),
    })
      .then(() => router.replace(returnPath))
      .catch(() => router.replace(returnPath))
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Logging in...</p>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallback />
    </Suspense>
  )
}
