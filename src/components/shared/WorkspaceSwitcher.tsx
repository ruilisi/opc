'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Plus, User, LogOut } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useWorkspace, type WorkspaceOrg } from '@/contexts/WorkspaceContext'
import CreateOrgDialog from '@/components/org/CreateOrgDialog'
import { useT } from '@/lib/i18n'

function OrgAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
      {initials}
    </div>
  )
}

export default function WorkspaceSwitcher() {
  const { orgs, activeOrg, setActiveOrg, addOrg } = useWorkspace()
  const { t } = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [createOrgOpen, setCreateOrgOpen] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    toast.success('Logged out')
  }

  function handleSelectOrg(org: WorkspaceOrg) {
    setActiveOrg(org)
    setOpen(false)
  }

  const personalOrgs = orgs.filter((o) => o.type === 'personal')
  const enterpriseOrgs = orgs.filter((o) => o.type === 'enterprise')

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors text-left">
          <div className="flex w-full items-center gap-2">
            {activeOrg ? <OrgAvatar name={activeOrg.name} /> : <div className="size-7 rounded-md bg-muted" />}
            <span className="flex-1 truncate text-left font-medium">
              {activeOrg?.name ?? t('ws_loading')}
            </span>
            <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-52">
          {personalOrgs.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => handleSelectOrg(org)} className="gap-2">
              <OrgAvatar name={org.name} />
              <span className="flex-1 truncate">{t('ws_personal')}</span>
              {activeOrg?.id === org.id && <Check size={14} />}
            </DropdownMenuItem>
          ))}
          {enterpriseOrgs.map((org) => (
            <DropdownMenuItem key={org.id} onClick={() => handleSelectOrg(org)} className="gap-2">
              <OrgAvatar name={org.name} />
              <span className="flex-1 truncate">{org.name}</span>
              {activeOrg?.id === org.id && <Check size={14} />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setOpen(false); setCreateOrgOpen(true) }} className="gap-2">
            <Plus size={14} />
            {t('ws_create_org')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setOpen(false); router.push('/profile') }} className="gap-2">
            <User size={14} />
            {t('ws_edit_profile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive">
            <LogOut size={14} />
            {t('ws_logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrgDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} onCreated={(org) => {
        const newOrg: WorkspaceOrg = { id: org.id, name: org.name, slug: org.slug, type: 'enterprise', myRole: 'owner' }
        addOrg(newOrg)
        setActiveOrg(newOrg)
      }} />
    </>
  )
}
