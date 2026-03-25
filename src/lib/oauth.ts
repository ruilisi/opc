'use client'

export function redirectToOAuth(returnPath = '/boards') {
  const redirectUri = `${window.location.origin}/oauth/callback`
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID ?? 'opc',
    redirect_uri: redirectUri,
    response_type: 'code',
    state: encodeURIComponent(returnPath),
  })
  window.location.href = `${process.env.NEXT_PUBLIC_OAUTH_WEB_URL}/oauth/authorize?${params}`
}
