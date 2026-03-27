'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Bug, Building2 } from 'lucide-react'
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext'
import WorkspaceSwitcher from '@/components/shared/WorkspaceSwitcher'

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { activeOrg, loading } = useWorkspace()

  const navItems = [
    { href: '/boards', icon: LayoutDashboard, label: 'Boards', show: true },
    {
      href: activeOrg ? `/orgs/${activeOrg.id}/sentry` : '#',
      icon: Bug,
      label: 'Sentry',
      show: !loading && !!activeOrg,
    },
    {
      href: activeOrg ? `/orgs/${activeOrg.id}` : '#',
      icon: Building2,
      label: 'Org Settings',
      show: !loading && activeOrg?.type === 'enterprise',
    },
    { href: '/settings', icon: Settings, label: 'Settings', show: true },
  ]

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/boards" className="text-lg font-bold">OPC</Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {navItems.filter((i) => i.show).map(({ href, icon: Icon, label }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith(href) && href !== '#' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-2">
          <WorkspaceSwitcher />
        </div>
      </aside>
      {/* Main content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-auto">
        {children}
      </main>
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShellInner>{children}</AppShellInner>
    </WorkspaceProvider>
  )
}
