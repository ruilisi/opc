'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Settings, Bug, Building2, Sun, Moon, Monitor, Languages } from 'lucide-react'
import { WorkspaceProvider, useWorkspace } from '@/contexts/WorkspaceContext'
import WorkspaceSwitcher from '@/components/shared/WorkspaceSwitcher'
import { useTheme } from 'next-themes'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useT, useI18n } from '@/lib/i18n'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useT()
  const icon = theme === 'dark' ? <Moon size={15} /> : theme === 'light' ? <Sun size={15} /> : <Monitor size={15} />
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem onClick={() => setTheme('light')}><Sun size={14} className="mr-2" />{t('theme_light')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}><Moon size={14} className="mr-2" />{t('theme_dark')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}><Monitor size={14} className="mr-2" />{t('theme_system')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LangToggle() {
  const { lang, setLang } = useI18n()
  const { t } = useT()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
        <Languages size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem onClick={() => setLang('en')} className={lang === 'en' ? 'font-medium' : ''}>{t('lang_en')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang('zh')} className={lang === 'zh' ? 'font-medium' : ''}>{t('lang_zh')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { activeOrg, loading } = useWorkspace()
  const { t } = useT()

  const navItems = [
    { href: '/boards', icon: LayoutDashboard, label: t('nav_boards'), show: true },
    {
      href: activeOrg ? `/orgs/${activeOrg.id}/sentry` : '#',
      icon: Bug,
      label: t('nav_sentry'),
      show: !loading && !!activeOrg,
    },
    {
      href: activeOrg ? `/orgs/${activeOrg.id}` : '#',
      icon: Building2,
      label: t('nav_org_settings'),
      show: !loading && activeOrg?.type === 'enterprise',
    },
    { href: '/settings', icon: Settings, label: t('nav_settings'), show: true },
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
        <div className="border-t p-2 flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <WorkspaceSwitcher />
          </div>
          <LangToggle />
          <ThemeToggle />
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
