'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import {
  createLeaveType,
  deleteLeaveType,
  fetchLeaveTypes,
  leaveTypeApiErrorMessage,
  updateLeaveType,
} from '@/lib/leaveTypesApi'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'

interface LeaveMasterTabProps {
  schoolId: number
  academicYearId: number
  academicYearLabel?: string
  token: string
}

const emptyForm = {
  name: '',
  is_paid: true,
  allow_carry_forward: false,
  annual_quota: '12',
  max_carry_forward: '0',
  is_half_day_type: false,
  is_active: true,
}

export default function LeaveMasterTab({
  schoolId,
  academicYearId,
  academicYearLabel,
  token,
}: LeaveMasterTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const queryKey = ['leave-types-master', schoolId, academicYearId]

  const { data: types, isLoading, isError, error, refetch } = useQuery(
    queryKey,
    () => fetchLeaveTypes(token, schoolId, academicYearId, false),
    { enabled: !!schoolId && !!academicYearId && !!token, retry: 1 }
  )

  const saveMutation = useMutation(
    async () => {
      const payload = {
        name: form.name.trim(),
        is_paid: form.is_paid,
        allow_carry_forward: form.is_paid && form.allow_carry_forward,
        annual_quota: parseFloat(form.annual_quota) || 0,
        max_carry_forward: form.is_paid ? parseFloat(form.max_carry_forward) || 0 : 0,
        is_half_day_type: form.is_half_day_type,
        is_active: form.is_active,
      }
      if (editingId) {
        return updateLeaveType(token, schoolId, academicYearId, editingId, payload)
      }
      return createLeaveType(token, schoolId, academicYearId, payload)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKey)
        queryClient.invalidateQueries(['leave-types-active', schoolId, academicYearId])
        resetForm()
        alert(editingId ? 'Leave type updated.' : 'Leave type added.')
      },
      onError: (err: unknown) =>
        alert(leaveTypeApiErrorMessage(err, 'Failed to save leave type')),
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => deleteLeaveType(token, schoolId, academicYearId, id),
    {
      onSuccess: (res) => {
        queryClient.invalidateQueries(queryKey)
        queryClient.invalidateQueries(['leave-types-active', schoolId, academicYearId])
        alert(res?.data?.message || 'Done')
      },
      onError: (err: unknown) =>
        alert(leaveTypeApiErrorMessage(err, 'Failed to delete leave type')),
    }
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (row: {
    id: number
    name: string
    is_paid: boolean
    allow_carry_forward: boolean
    annual_quota: number
    max_carry_forward: number
    is_half_day_type: boolean
    is_active: boolean
  }) => {
    setEditingId(row.id)
    setForm({
      name: row.name,
      is_paid: !!row.is_paid,
      allow_carry_forward: !!row.allow_carry_forward,
      annual_quota: String(row.annual_quota ?? 0),
      max_carry_forward: String(row.max_carry_forward ?? 0),
      is_half_day_type: !!row.is_half_day_type,
      is_active: !!row.is_active,
    })
    setShowForm(true)
  }

  const sortedTypes = useMemo(
    () =>
      [...(types || [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [types]
  )

  return (
    <>
      {isError && (
        <div className="mb-2 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          {leaveTypeApiErrorMessage(error, 'Could not load leave types.')}{' '}
          <button type="button" onClick={() => refetch()} className="underline font-medium">
            Retry
          </button>
        </div>
      )}

      <MasterDataTabShell
        title="Leave Types"
        subtitle={`${sortedTypes.length} type${sortedTypes.length === 1 ? '' : 's'} · ${academicYearLabel || academicYearId}`}
        toolbarActions={
          <MasterDataToolbarBtn
            onClick={() => {
              if (showForm) resetForm()
              else setShowForm(true)
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{showForm ? 'Cancel' : 'Add Leave Type'}</span>
          </MasterDataToolbarBtn>
        }
        footer={sortedTypes.length ? `Showing ${sortedTypes.length} records` : undefined}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
        ) : sortedTypes.length ? (
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-center">Paid</th>
                  <th className="text-center">Quota</th>
                  <th className="text-center">Carry Fwd</th>
                  <th className="text-center">½ Day</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedTypes.map((row) => (
                  <tr key={row.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0">
                      <span className="md-cell-text font-medium text-white" title={row.name}>
                        {row.name}
                      </span>
                    </td>
                    <td className="text-center">
                      <MasterDataStatusTag
                        active={row.is_paid}
                        label={row.payment_label || (row.is_paid ? 'Paid' : 'Unpaid')}
                        tone={row.is_paid ? 'active' : 'warning'}
                      />
                    </td>
                    <td className="text-center tabular-nums text-white/70">{row.annual_quota}</td>
                    <td className="text-center text-white/70 text-[11px]">
                      {row.is_paid && row.allow_carry_forward
                        ? `Yes (max ${row.max_carry_forward})`
                        : 'No'}
                    </td>
                    <td className="text-center text-white/70">{row.is_half_day_type ? 'Yes' : 'No'}</td>
                    <td className="text-center">
                      <MasterDataStatusTag active={row.is_active} label={row.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="md-action-link md-action-edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove leave type "${row.name}"?`)) {
                              deleteMutation.mutate(row.id)
                            }
                          }}
                          className="md-action-link md-action-delete"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MasterDataDenseTable>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
            No leave types yet. Click <strong className="text-white/75">Add Leave Type</strong> to create one.
          </div>
        )}
      </MasterDataTabShell>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
            <h3 className="modal-title mb-4">
              {editingId ? 'Edit Leave Type' : 'New Leave Type'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.name.trim()) {
                  alert('Leave type name is required')
                  return
                }
                saveMutation.mutate()
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              <div className="md:col-span-2">
                <label className="label-text mb-1">Leave Type Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="e.g. Casual Leave"
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Annual Quota (days)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.annual_quota}
                  onChange={(e) => setForm((p) => ({ ...p, annual_quota: e.target.value }))}
                  className="input-field"
                />
                <p className="text-xs text-white/50 mt-1">Max days staff can apply per year</p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.is_paid}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        is_paid: e.target.checked,
                        allow_carry_forward: e.target.checked ? p.allow_carry_forward : false,
                        max_carry_forward: e.target.checked ? p.max_carry_forward : '0',
                      }))
                    }
                    className="rounded border-white/30"
                  />
                  Paid leave
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.is_half_day_type}
                    onChange={(e) => setForm((p) => ({ ...p, is_half_day_type: e.target.checked }))}
                    className="rounded border-white/30"
                  />
                  Counts as half day (0.5 day deduction)
                </label>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="rounded border-white/30"
                  />
                  Active (show in dropdown)
                </label>
              </div>
              {form.is_paid && (
                <>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={form.allow_carry_forward}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, allow_carry_forward: e.target.checked }))
                        }
                        className="rounded border-white/30"
                      />
                      Allow carry forward to next year
                    </label>
                  </div>
                  <div>
                    <label className="label-text mb-1">Max Carry Forward (days)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      disabled={!form.allow_carry_forward}
                      value={form.max_carry_forward}
                      onChange={(e) => setForm((p) => ({ ...p, max_carry_forward: e.target.value }))}
                      className="input-field disabled:opacity-50"
                    />
                  </div>
                </>
              )}
              {!form.is_paid && (
                <div className="md:col-span-2 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-400/25 rounded-md px-3 py-2">
                  Unpaid leaves do not use carry forward. Quota can be 0 for unlimited unpaid
                  requests, or a limit if you track unpaid days.
                </div>
              )}
              <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary px-3 py-1.5 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isLoading}
                  className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
