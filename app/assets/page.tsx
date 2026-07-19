'use client'

import SelectField from '@/components/SelectField'
import SingleSelectDropdown from '@/components/SingleSelectDropdown'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useMemo } from 'react'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterBar,
  PageFilterClearButton,
  PageFilterField,
  PageFilterRow,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { useBranchYearScope } from '@/lib/useBranchYearScope'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const CONDITION_STATUSES = ['Good', 'Fair', 'Repair Needed', 'Disposed'] as const

function AssetsTableColgroup({ showActions }: { showActions: boolean }) {
  return (
    <colgroup>
      <col className="assets-col-name" />
      <col className="assets-col-qty" />
      <col className="assets-col-room" />
      <col className="assets-col-condition" />
      <col className="assets-col-branch" />
      {showActions ? <col className="assets-col-actions" /> : null}
    </colgroup>
  )
}

const emptyForm = {
  asset_name_id: '',
  quantity: '1',
  location: '',
  purchase_value: '',
  condition_status: 'Good' as (typeof CONDITION_STATUSES)[number],
  remarks: '',
}

export default function AssetsPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { hasFeature } = useSchoolFeatures()
  const {
    branch,
    branchScopeKey,
    scopedHeaders: headers,
    requireBranchForWrite,
  } = useBranchYearScope()
  const { canAccess, accessLoading } = useRequirePageAccess('/assets')
  const isAllowed = canAccess

  const canAdd = hasFeature('assets.add')
  const canEdit = hasFeature('assets.edit')
  const canDelete = hasFeature('assets.delete')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterAssetNameId, setFilterAssetNameId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const queryClient = useQueryClient()
  const schoolId = user?.school_id

  const { data: assetNames, isLoading: namesLoading } = useQuery(
    ['asset-names', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/asset-master/names`, {
        params: { school_id: schoolId, active_only: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    { enabled: !!schoolId && !!token && isAllowed }
  )

  const { data: assets, isLoading: assetsLoading } = useQuery(
    ['school-assets', schoolId, academicYear?.id, branchScopeKey, filterAssetNameId],
    async () => {
      const res = await axios.get(`${API_URL}/assets`, {
        params: {
          school_id: schoolId,
          academic_year_id: academicYear?.id,
          asset_name_id: filterAssetNameId || undefined,
        },
        headers,
      })
      return res.data.data
    },
    { enabled: !!schoolId && !!academicYear?.id && !!token && isAllowed }
  )

  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return assets || []
    const q = searchTerm.trim().toLowerCase()
    return (assets || []).filter(
      (a: any) =>
        a.asset_name?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q)
    )
  }, [assets, searchTerm])

  const assetTotals = useMemo(() => {
    return filteredAssets.reduce(
      (sum, item: any) => sum + (Number(item.quantity) || 0),
      0
    )
  }, [filteredAssets])

  const showActionsCol = canEdit || canDelete

  const saveMutation = useMutation(
    async () => {
      const branchErr = requireBranchForWrite()
      if (branchErr) {
        throw new Error(branchErr)
      }
      const payload = {
        school_id: schoolId,
        academic_year_id: academicYear?.id,
        branch_id: branch?.id,
        asset_name_id: Number(form.asset_name_id),
        quantity: Number(form.quantity) || 1,
        location: form.location.trim() || null,
        purchase_value: form.purchase_value ? Number(form.purchase_value) : null,
        condition_status: form.condition_status,
        remarks: form.remarks.trim() || null,
      }
      if (editingId) {
        return axios.put(`${API_URL}/assets/${editingId}`, payload, { headers })
      }
      return axios.post(`${API_URL}/assets`, payload, { headers })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['school-assets'])
        resetForm()
        setSuccessMessage(editingId ? 'Asset updated successfully.' : 'Asset added successfully.')
        setError('')
      },
      onError: (err: any) => {
        setError(err.response?.data?.error || err.message || 'Failed to save asset')
        setSuccessMessage('')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await axios.delete(`${API_URL}/assets/${id}`, {
        params: { school_id: schoolId },
        headers,
      })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['school-assets'])
        setSuccessMessage('Asset removed.')
        setError('')
      },
      onError: (err: any) => {
        setError(err.response?.data?.error || 'Failed to remove asset')
        setSuccessMessage('')
      },
    }
  )

  const openAddForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
    setShowForm(true)
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setError('')
    setForm({
      asset_name_id: String(item.asset_name_id),
      quantity: String(item.quantity ?? 1),
      location: item.location || '',
      purchase_value: item.purchase_value != null ? String(item.purchase_value) : '',
      condition_status: item.condition_status || 'Good',
      remarks: item.remarks || '',
    })
    setShowForm(true)
  }

  const assetNameOptions = useMemo(
    () =>
      [...(assetNames || [])].map((n: any) => ({
        value: String(n.id),
        label: n.name,
      })),
    [assetNames]
  )

  const hasActiveFilters = Boolean(searchTerm.trim() || filterAssetNameId)

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers,
    config: {
      mode: 'data',
      title: 'School Assets',
      filename: 'assets',
      getSubtitle: () => {
        const parts: string[] = []
        if (searchTerm.trim()) parts.push(`Search: ${searchTerm.trim()}`)
        if (filterAssetNameId) {
          const name = assetNameOptions.find((o) => o.value === filterAssetNameId)?.label
          if (name) parts.push(`Type: ${name}`)
        }
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'asset_name', label: 'Asset' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'location', label: 'Room No.' },
        { key: 'condition_status', label: 'Condition' },
        { key: 'branch_name', label: 'Branch' },
        { key: 'purchase_value', label: 'Purchase Value' },
        { key: 'remarks', label: 'Remarks' },
      ],
      getRows: () =>
        filteredAssets.map((a: any) => ({
          asset_name: a.asset_name || '',
          quantity: a.quantity ?? '',
          location: a.location || '',
          condition_status: a.condition_status || '',
          branch_name: a.branch_name || '',
          purchase_value: a.purchase_value ?? '',
          remarks: a.remarks || '',
        })),
    },
  })

  if (accessLoading) {
    return (
      <Layout>
        <div className="p-6 text-slate-500">Loading...</div>
      </Layout>
    )
  }

  if (!isAllowed) {
    return (
      <Layout>
        <div className="p-6 text-red-600">You do not have access to Assets.</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="fees-page-layout assets-page-layout">
        <div className="shrink-0 fees-page-toolbar">
          <div className="glass-card p-2 sm:px-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white">Assets</h1>
              <p className="text-xs text-white/60 mt-0.5">
                Configure types in Master Data → Assets.
              </p>
            </div>
            {canAdd && (
              <button
                type="button"
                onClick={openAddForm}
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 shrink-0"
              >
                + Add Asset
              </button>
            )}
          </div>
        </div>

        {successMessage && (
          <div className="shrink-0 bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 px-3 py-2 rounded-lg text-sm">
            {successMessage}
          </div>
        )}
        {!showForm && error && (
          <div className="shrink-0 bg-red-500/20 border border-red-400/40 text-red-100 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <PageFilterBar className="fees-page-filters shrink-0" error={exportError}>
          <PageFilterRow className="gap-2 lg:gap-2.5">
            <PageFilterSearch
              id="asset-search"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by name or room no..."
            />

            <PageFilterField id="asset-type-filter" label="Asset type" width="wide">
              <SingleSelectDropdown
                id="asset-type-filter"
                value={filterAssetNameId}
                onChange={setFilterAssetNameId}
                options={assetNameOptions}
                placeholder="All asset types"
                searchable
                aria-label="Filter by asset type"
              />
            </PageFilterField>

            {hasActiveFilters ? (
              <PageFilterClearButton
                label="Clear filters"
                onClick={() => {
                  setSearchTerm('')
                  setFilterAssetNameId('')
                }}
              />
            ) : null}

            <PageFilterActions>
              <ExportMenu
                onExport={handleExport}
                isExporting={isExporting}
                recordCount={filteredAssets.length}
                size="sm"
              />
            </PageFilterActions>
          </PageFilterRow>
        </PageFilterBar>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col table-shell fees-page-table assets-page-table overflow-hidden">
            <div className="fees-table-scroll min-h-0">
              <table className="data-table assets-table">
                <AssetsTableColgroup showActions={showActionsCol} />
                <thead className="sticky">
                  <tr>
                    <th className="assets-col-name">Asset</th>
                    <th className="assets-col-qty text-right">Qty</th>
                    <th className="assets-col-room">Room No.</th>
                    <th className="assets-col-condition">Condition</th>
                    <th className="assets-col-branch">Branch</th>
                    {showActionsCol ? <th className="assets-col-actions">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {assetsLoading ? (
                    <tr>
                      <td colSpan={showActionsCol ? 6 : 5} className="text-center py-8 text-white/60">
                        Loading assets...
                      </td>
                    </tr>
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={showActionsCol ? 6 : 5} className="text-center py-8 text-white/60">
                        {hasActiveFilters
                          ? 'No assets match your search or filters.'
                          : 'No assets recorded. Add assets to track school equipment for this academic year.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((item: any) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="assets-col-name">
                          <span className="fees-cell-name font-medium text-white" title={item.asset_name}>
                            {item.asset_name}
                          </span>
                        </td>
                        <td className="assets-col-qty fees-cell-amount text-right text-white/80">
                          {item.quantity}
                        </td>
                        <td className="assets-col-room fees-cell-amount text-white/80">
                          {item.location || '—'}
                        </td>
                        <td className="assets-col-condition">
                          <span className="badge-success">{item.condition_status}</span>
                        </td>
                        <td className="assets-col-branch">
                          <span className="fees-cell-name text-white/80" title={item.branch_name || undefined}>
                            {item.branch_name || '—'}
                          </span>
                        </td>
                        {showActionsCol && (
                          <td className="assets-col-actions whitespace-nowrap">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="text-primary-300 hover:text-primary-200"
                              >
                                Edit
                              </button>
                            )}
                            {canEdit && canDelete ? <span className="text-white/30 mx-1">·</span> : null}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Remove "${item.asset_name}"?`)) deleteMutation.mutate(item.id)
                                }}
                                className="text-red-300 hover:text-red-200"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!assetsLoading && filteredAssets.length > 0 ? (
              <div className="assets-table-summary shrink-0">
                <table className="data-table assets-table w-full">
                  <AssetsTableColgroup showActions={showActionsCol} />
                  <tbody>
                    <tr>
                      <td className="assets-col-name text-left font-semibold text-white/90">
                        <span className="fees-table-totals-label">
                          <span>Total</span>
                          <span className="fees-table-totals-count">
                            {filteredAssets.length}{' '}
                            {hasActiveFilters ? 'matching ' : ''}
                            asset{filteredAssets.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </td>
                      <td className="assets-col-qty fees-cell-amount text-right font-semibold text-white">
                        <span className="assets-table-summary-qty-label">Total qty</span>
                        <span className="assets-table-summary-qty-value">{assetTotals}</span>
                      </td>
                      <td colSpan={showActionsCol ? 4 : 3} className="assets-table-summary-spacer" />
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>

        {showForm && (canAdd || (canEdit && editingId)) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <div
              className="glass-card p-4 sm:p-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-visible"
              role="dialog"
              aria-modal="true"
              aria-labelledby="asset-form-title"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 id="asset-form-title" className="page-title text-base">
                  {editingId ? 'Edit Asset' : 'Add Asset'}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-white/60 hover:text-white p-1"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-3 bg-red-500/20 border border-red-400/40 text-red-100 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {namesLoading ? (
                <p className="text-sm text-white/70">Loading asset types...</p>
              ) : assetNameOptions.length === 0 ? (
                <p className="text-sm text-amber-200 bg-amber-500/20 border border-amber-400/30 rounded-md px-3 py-2">
                  No asset types configured. Add asset names in Master Data → Assets first.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="relative min-w-0">
                    <label className="label-text mb-1">Asset Name *</label>
                    <SelectField
                      value={form.asset_name_id}
                      onChange={(e) => setForm({ ...form, asset_name_id: e.target.value })}
                      className="select-field w-full"
                      required
                    >
                      <option value="">Select asset name</option>
                      {assetNameOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="min-w-0">
                      <label className="label-text mb-1 text-xs">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        className="input-field py-1.5 text-sm w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="label-text mb-1 text-xs">Room No.</label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        placeholder="e.g. 12"
                        className="input-field py-1.5 text-sm w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="label-text mb-1 text-xs">Value</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.purchase_value}
                        onChange={(e) => setForm({ ...form, purchase_value: e.target.value })}
                        className="input-field py-1.5 text-sm w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="label-text mb-1 text-xs">Condition</label>
                      <SelectField
                        value={form.condition_status}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            condition_status: e.target.value as (typeof CONDITION_STATUSES)[number],
                          })
                        }
                        className="select-field select-field-compact w-full"
                      >
                        {CONDITION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                  <div>
                    <label className="label-text mb-1 text-xs">Remarks</label>
                    <input
                      type="text"
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                      placeholder="Optional notes"
                      className="input-field py-1.5 text-sm w-full"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-1.5 text-sm font-medium text-white/80 bg-white/10 border border-white/20 rounded-md hover:bg-white/20"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveMutation.mutate()}
                      disabled={
                        !form.asset_name_id ||
                        saveMutation.isLoading ||
                        assetNameOptions.length === 0
                      }
                      className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saveMutation.isLoading ? 'Saving...' : editingId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
