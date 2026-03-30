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
  addOrg: (org: WorkspaceOrg) => void
  removeOrg: (orgId: string) => void
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  orgs: [],
  activeOrg: null,
  user: null,
  setActiveOrg: () => {},
  addOrg: () => {},
  removeOrg: () => {},
  loading: true,
})

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<WorkspaceOrg[]>([])
  const [activeOrg, setActiveOrgState] = useState<WorkspaceOrg | null>(null)
  const [user, setUser] = useState<WorkspaceUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/orgs').then((r) => r.ok ? r.json() : []),
      fetch('/api/auth/me').then((r) => r.ok ? r.json() : null),
    ]).then(([orgsData, userData]) => {
      const list: WorkspaceOrg[] = (Array.isArray(orgsData) ? orgsData : []).map((o: WorkspaceOrg & { members?: { role: string }[] }) => ({
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

  function addOrg(org: WorkspaceOrg) {
    setOrgs((prev) => [...prev, org])
  }

  function removeOrg(orgId: string) {
    setOrgs((prev) => prev.filter((o) => o.id !== orgId))
    setActiveOrgState((prev) => {
      if (prev?.id !== orgId) return prev
      const remaining = orgs.filter((o) => o.id !== orgId)
      return remaining.find((o) => o.type === 'personal') ?? remaining[0] ?? null
    })
  }

  return (
    <WorkspaceContext.Provider value={{ orgs, activeOrg, user, setActiveOrg, addOrg, removeOrg, loading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
