'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { Building2, Layers, Save, X } from 'lucide-react'
import FeatureAccordion, { type FeatureModule } from './FeatureAccordion'
import FeatureToast, { type FeatureToastData } from './FeatureToast'
import { getApiUrl } from '@/lib/api'

type SchoolInfo = {
  id: number
  name: string
  code: string
  branch_count: number
  current_plan: string
}

type Props = {
  schoolId: number
  token: string
  onClose: () => void
}

export default function SchoolFeaturesDrawer({ schoolId, token, onClose }: Props) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<FeatureToastData | null>(null)
  const drawerScrollRef = useRef<HTMLDivElement>(null)

  const { data: catalog } = useQuery(
    ['feature-catalog'],
    async () => {
      const res = await axios.get(`${getApiUrl()}/school-features/catalog`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data as FeatureModule[]
    },
    { enabled: !!token }
  )

  const { data: schoolData, isLoading } = useQuery(
    ['school-features', schoolId],
    async () => {
      const res = await axios.get(`${getApiUrl()}/school-features/${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data as {
        school: SchoolInfo
        enabled_features: string[]
        has_existing_config: boolean
        total_features: number
      }
    },
    { enabled: !!token && !!schoolId }
  )

  useEffect(() => {
    if (schoolData?.enabled_features) {
      setSelected(new Set(schoolData.enabled_features))
    }
  }, [schoolData])

  const saveMutation = useMutation(
    async (features: string[]) => {
      const res = await axios.put(
        `${getApiUrl()}/school-features/${schoolId}`,
        { features },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['school-features', schoolId])
        queryClient.invalidateQueries(['school-features-context'])
        setToast({
          title: data.data?.is_update
            ? 'Features updated successfully'
            : 'Features assigned successfully',
          lines: [
            `School: ${data.data?.school_name}`,
            `Total enabled: ${data.data?.total_enabled}`,
            `By: ${data.data?.assigned_by}`,
          ],
        })
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to save features')
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

  const allKeys = useMemo(
    () => catalog?.flatMap((m) => m.features.map((f) => f.key)) ?? [],
    [catalog]
  )

  const selectAll = () => setSelected(new Set(allKeys))
  const deselectAll = () => setSelected(new Set())

  const school = schoolData?.school
  const isUpdate = schoolData?.has_existing_config
  const totalFeatures = schoolData?.total_features ?? allKeys.length

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Manage School Features"
      >
        <div
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />

        <div className="feature-drawer feature-light-surface relative z-10">
        <header className="shrink-0 px-6 py-5 bg-white border-b border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 mb-1">
                Super Admin
              </p>
              <h2 className="text-xl font-bold text-slate-900">Manage School Features</h2>
              <p className="text-sm text-slate-500 mt-1">
                Select modules and permissions available for this school.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div ref={drawerScrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden fm-drawer-scroll">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {school && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{school.name}</p>
                      <p className="text-sm text-slate-500">{school.code}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Branches', value: school.branch_count },
                      { label: 'Plan', value: school.current_plan },
                      { label: 'Enabled', value: selected.size, highlight: true },
                      { label: 'Total', value: totalFeatures },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          {item.label}
                        </p>
                        <p
                          className={`text-lg font-bold tabular-nums ${
                            item.highlight ? 'text-emerald-600' : 'text-slate-800'
                          }`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {catalog && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-semibold text-slate-700">Feature checklist</h3>
                  </div>
                  <FeatureAccordion
                    modules={catalog}
                    selected={selected}
                    onChange={handleChange}
                    showSearch
                    scrollRootRef={drawerScrollRef}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 px-6 py-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Deselect all
            </button>
            <div className="flex-1" />
            <span className="text-xs text-slate-400 hidden sm:inline tabular-nums">
              {selected.size} / {totalFeatures} enabled
            </span>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate([...selected])}
              disabled={saveMutation.isLoading || isLoading}
              className="inline-flex items-center gap-2 btn-primary"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isLoading
                ? 'Saving...'
                : isUpdate
                  ? 'Update Features'
                  : 'Save Features'}
            </button>
          </div>
        </footer>
        </div>
      </div>

      <FeatureToast toast={toast} onClose={() => setToast(null)} />
    </>
  )
}
