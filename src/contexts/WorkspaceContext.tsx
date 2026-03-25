'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface WorkspaceOrg {
  id: string
  name: string
  slug: string
  type: 'personal' | 'enterprise'
  myRole: string
}

interface WorkspaceUser {
  id: string
  name: string
  avatarUrl?: string | null
}

interface WorkspaceContextValue {
  orgs: WorkspaceOrg[]
  activeOrg: WorkspaceOrg | null
  user: WorkspaceUser | null
  setActiveOrg: (org: WorkspaceOrg) => void
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  orgs: [],
  activeOrg: null,
  user: null,
  setActiveOrg: () => {},
  loading: true,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<WorkspaceOrg[]>([])
  const [activeOrg, setActiveOrgState] = useState<WorkspaceOrg | null>(null)
  const [user, setUser] = useState<WorkspaceUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/orgs').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ]).then(([orgsData, userData]) => {
      const list: WorkspaceOrg[] = orgsData.map((o: WorkspaceOrg & { members?: { role: string }[] }) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        type: o.type,
        myRole: o.members?.[0]?.role ?? o.myRole,
      }))
      setOrgs(list)
      setUser(userData)

      const savedId = typeof window !== 'undefined' ? localStorage.getItem('opc_active_org_id') : null
      const saved = savedId ? list.find((o) => o.id === savedId) : null
      const personal = list.find((o) => o.type === 'personal')
      setActiveOrgState(saved ?? personal ?? list[0] ?? null)
    }).finally(() => setLoading(false))
  }, [])

  function setActiveOrg(org: WorkspaceOrg) {
    setActiveOrgState(org)
    if (typeof window !== 'undefined') {
      localStorage.setItem('opc_active_org_id', org.id)
    }
  }

  return (
    <WorkspaceContext.Provider value={{ orgs, activeOrg, user, setActiveOrg, loading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
