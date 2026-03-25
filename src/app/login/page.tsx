'use client'

import { redirectToOAuth } from '@/lib/oauth'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center">
        <div>
          <h1 className="text-3xl font-bold">OPC</h1>
          <p className="mt-2 text-muted-foreground">Project Management</p>
        </div>
        <Button size="lg" onClick={() => redirectToOAuth('/boards')}>
          Login
        </Button>
      </div>
    </div>
  )
}
