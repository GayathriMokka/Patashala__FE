'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { Lock, Save, Search, Shield } from 'lucide-react'
import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import PageHeader from '@/components/PageHeader'
import PageContainer from '@/components/PageContainer'
import FeatureAccordion, { type FeatureModule } from '@/components/features/FeatureAccordion'
import FeatureFlowGuide from '@/components/features/FeatureFlowGuide'
import FeatureToast, { type FeatureToastData } from '@/components/features/FeatureToast'
import TeacherDutyPanel from '@/components/features/TeacherDutyPanel'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { getApiUrl } from '@/lib/api'
import { getRoleTabIcon } from '@/lib/schoolUserRoles'

type RoleInfo = { id: number; name: string }

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export default function FeaturesPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const queryClient = useQueryClient()
  const { hasFeature, refetch: refetchContext } = useSchoolFeatures()
  const [selectedRole, setSelectedRole] = useState<RoleInfo | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [savedSnapshot, setSavedSnapshot] = useState<Set<string>>(new Set())
  const [roleSearch, setRoleSearch] = useState('')
  const [toast, setToast] = useState<FeatureToastData | null>(null)
  const permissionsScrollRef = useRef<HTMLDivElement>(null)

  const schoolId = user?.school_id
  const isSuperAdmin = user?.role_name === 'Super Admin'
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(
    isSuperAdmin ? null : (user?.school_id ?? null)
  )
  const effectiveSchoolId = isSuperAdmin ? selectedSchoolId : schoolId

  const canManage =
    isSuperAdmin ||
    (user?.role_name === 'School Admin' && hasFeature('feature_management.access'))

  const { data: schools } = useQuery(
    ['schools'],
    async () => {
      const res = await axios.get(`${getApiUrl()}/schools`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data as { id: number; name: string; code: string }[]
    },
    { enabled: !!token && isSuperAdmin }
  )

  const { data: catalog } = useQuery(
    ['feature-catalog'],
    async () => {
      const res = await axios.get(`${getApiUrl()}/school-features/catalog`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data as FeatureModule[]
    },
    { enabled: !!token && canManage }
  )

  const { data: matrix, isLoading: matrixLoading } = useQuery(
    ['role-matrix', effectiveSchoolId],
    async () => {
      const res = await axios.get(`${getApiUrl()}/school-features/${effectiveSchoolId}/role-matrix`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data as {
        granted_modules: string[]
        locked_modules: { id: string; label: string }[]
        enabled_roles: RoleInfo[]
      }
    },
    { enabled: !!token && !!effectiveSchoolId && canManage }
  )

  const { data: roleData, isLoading: roleLoading, isFetching: roleFetching } = useQuery(
    ['role-features', effectiveSchoolId, selectedRole?.id],
    async () => {
      const res = await axios.get(
        `${getApiUrl()}/school-features/${effectiveSchoolId}/roles/${selectedRole!.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data.data as {
        enabled_features: string[]
        has_existing_config: boolean
      }
    },
    { enabled: !!token && !!effectiveSchoolId && !!selectedRole && canManage, keepPreviousData: true }
  )

  const { data: summary } = useQuery(
    ['feature-summary', effectiveSchoolId],
    async () => {
      const res = await axios.get(`${getApiUrl()}/school-features/summary`, {
        params: isSuperAdmin ? { school_id: effectiveSchoolId } : undefined,
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    { enabled: !!token && !!effectiveSchoolId && canManage }
  )

  useEffect(() => {
    if (matrix?.enabled_roles?.length && !selectedRole) {
      setSelectedRole(matrix.enabled_roles[0])
    }
  }, [matrix, selectedRole])

  useEffect(() => {
    if (roleData?.enabled_features) {
      const next = new Set(roleData.enabled_features)
      setSelected(next)
      setSavedSnapshot(new Set(roleData.enabled_features))
    }
  }, [roleData])

  const saveMutation = useMutation(
    async (features: string[]) => {
      const res = await axios.put(
        `${getApiUrl()}/school-features/${effectiveSchoolId}/roles/${selectedRole!.id}`,
        { features },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data
    },
    {
      onSuccess: (data) => {
        setSavedSnapshot(new Set(selected))
        queryClient.invalidateQueries(['feature-summary', effectiveSchoolId])
        queryClient.invalidateQueries(['role-features', effectiveSchoolId, selectedRole?.id])
        refetchContext()
        queryClient.invalidateQueries(['teacher-duty-info', effectiveSchoolId])
        setToast({
          title: data.data?.is_update ? 'Permissions updated' : 'Permissions saved',
          lines: [`${selectedRole?.name}: changes live for all users with this role.`],
        })
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to save permissions')
      },
    }
  )

  const handleChange = useCallback((key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const grantableModules = useMemo(
    () =>
      catalog?.filter(
        (m) => !m.isRoleModule && matrix?.granted_modules.includes(m.id)
      ) ?? [],
    [catalog, matrix]
  )

  const lockedKeys = useMemo(
    () =>
      new Set(
        catalog
          ?.filter((m) => !m.isRoleModule && !matrix?.granted_modules.includes(m.id))
          .flatMap((m) => m.features.map((f) => f.key)) ?? []
      ),
    [catalog, matrix]
  )

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase()
    const roles = matrix?.enabled_roles ?? []
    if (!q) return roles
    return roles.filter((r) => r.name.toLowerCase().includes(q))
  }, [matrix, roleSearch])

  const grantableKeySet = useMemo(
    () => new Set(grantableModules.flatMap((m) => m.features.map((f) => f.key))),
    [grantableModules]
  )

  const isDirty = !setsEqual(selected, savedSnapshot)
  const enabledCount = [...selected].filter((k) => grantableKeySet.has(k)).length
  const totalGrantable = grantableKeySet.size

  if (!canManage) {
    return (
      <Layout>
        <PageContainer>
          <div className="glass-card-opaque p-8 text-center max-w-md mx-auto">
            <Shield className="w-10 h-10 text-white/60 mx-auto mb-3" />
            <p className="text-white/80 text-sm">
              Feature management is not enabled for your role. Contact your Super Admin to grant
              &quot;Manage Role Permissions&quot; under Features.
            </p>
          </div>
        </PageContainer>
      </Layout>
    )
  }

  if (isSuperAdmin && !effectiveSchoolId) {
    return (
      <Layout>
        <PageContainer>
          <PageHeader
            title="Role Permissions"
            subtitle="Select a school to manage role permissions."
            compact
          />
          <div className="glass-card-opaque p-6 max-w-md">
            <label htmlFor="features-school" className="block text-sm font-medium text-white/90 mb-2">
              School <span className="text-red-300">*</span>
            </label>
            <SelectField
              id="features-school"
              value={selectedSchoolId || ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                setSelectedSchoolId(id)
                setSelectedRole(null)
              }}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900"
            >
              <option value="" disabled>
                Select a school
              </option>
              {schools?.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </SelectField>
            <p className="mt-3 text-sm text-white/70">
              Enable school modules first from the Schools page if no permissions appear.
            </p>
          </div>
        </PageContainer>
      </Layout>
    )
  }

  return (
    <Layout>
      <PageContainer fill className="fm-page">
        <div className="fm-page-hero">
          <PageHeader
            title="Role Permissions"
            subtitle="Assign what each role can access. Pick a role, adjust permissions, then save."
            compact
          />
          {isSuperAdmin && (
            <div className="fm-school-picker">
              <label htmlFor="features-school-bar" className="fm-school-picker-label">
                School
              </label>
              <SelectField
                id="features-school-bar"
                value={effectiveSchoolId || ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setSelectedSchoolId(id)
                  setSelectedRole(null)
                }}
                className="fm-school-select"
              >
                {schools?.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </SelectField>
            </div>
          )}
          <FeatureFlowGuide />
          <div className="fm-stats-bar">
            <span><strong>{summary?.school_features_enabled ?? '—'}</strong> school features</span>
            <span className="fm-stats-dot" aria-hidden />
            <span><strong>{matrix?.enabled_roles?.length ?? '—'}</strong> roles</span>
            <span className="fm-stats-dot" aria-hidden />
            <span><strong>{summary?.users_assigned ?? '—'}</strong> users</span>
            {summary?.last_updated_at && (
              <>
                <span className="fm-stats-dot" aria-hidden />
                <span>
                  Last saved {new Date(summary.last_updated_at).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="fm-workspace">
          <aside className="fm-role-rail feature-light-surface" aria-label="Roles">
            <div className="fm-role-rail-head">
              <h2 className="fm-role-rail-title">Roles</h2>
              <p className="fm-role-rail-sub">Select one to edit permissions</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search roles…"
                className="fm-search-input"
                aria-label="Search roles"
              />
            </div>
            <div className="fm-role-list">
              {matrixLoading ? (
                <p className="text-sm text-slate-500 px-2 py-4">Loading roles…</p>
              ) : filteredRoles.length === 0 ? (
                <p className="text-sm text-slate-500 px-2 py-4">No roles match your search.</p>
              ) : (
                filteredRoles.map((role) => {
                  const active = selectedRole?.id === role.id
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`fm-role-pick ${active ? 'fm-role-pick-active' : ''}`}
                      aria-pressed={active}
                    >
                      <span className="fm-role-pick-icon" aria-hidden>{getRoleTabIcon(role.name)}</span>
                      <span className="fm-role-pick-name">{role.name}</span>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          <div className="fm-card feature-light-surface">
          {!selectedRole ? (
            <div className="fm-empty">Select a role from the list to edit permissions.</div>
          ) : roleLoading && !roleData ? (
            <div className="fm-empty">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" aria-hidden />
              <span>Loading permissions…</span>
            </div>
          ) : (
            <div className="fm-card-body">
              {roleFetching && (
                <div className="fm-loading-bar" aria-hidden />
              )}
              <div className="fm-role-header">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="fm-role-header-icon" aria-hidden>{getRoleTabIcon(selectedRole.name)}</span>
                  <div className="min-w-0">
                    <h2 className="fm-role-header-title">{selectedRole.name}</h2>
                    <p className="fm-role-header-meta">
                      <span className="fm-role-header-count">{enabledCount}</span>
                      <span> of {totalGrantable} permissions enabled</span>
                      {isDirty && (
                        <span className="fm-role-header-dirty"> · Unsaved changes</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        new Set(
                          grantableModules.flatMap((m) =>
                            m.features.filter((f) => !lockedKeys.has(f.key)).map((f) => f.key)
                          )
                        )
                      )
                    }
                    className="fm-btn-ghost"
                  >
                    Enable all
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="fm-btn-ghost"
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate([...selected])}
                    disabled={saveMutation.isLoading || !isDirty}
                    className="fm-btn-save"
                  >
                    <Save className="w-4 h-4" aria-hidden />
                    {saveMutation.isLoading ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>

              {selectedRole.name === 'Teacher' && effectiveSchoolId && token && (
                <div className="fm-card-meta px-4 pb-2">
                  <TeacherDutyPanel
                    schoolId={effectiveSchoolId}
                    token={token}
                    academicYearId={academicYear?.id}
                  />
                </div>
              )}

              {matrix?.locked_modules && matrix.locked_modules.length > 0 && (
                <div className="fm-card-meta fm-locked px-4 pb-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span className="font-medium text-slate-600">Super Admin only:</span>
                  {matrix.locked_modules.map((m) => (
                    <span key={m.id} className="fm-locked-tag">{m.label}</span>
                  ))}
                </div>
              )}

              <div ref={permissionsScrollRef} className="fm-permissions">
                <FeatureAccordion
                  modules={grantableModules}
                  selected={selected}
                  onChange={handleChange}
                  lockedKeys={lockedKeys}
                  showSearch
                  scrollRootRef={permissionsScrollRef}
                />
              </div>
            </div>
          )}
          </div>
        </div>
      </PageContainer>

      <FeatureToast toast={toast} onClose={() => setToast(null)} />
    </Layout>
  )
}
