'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { getApiUrl } from '@/lib/api'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'

interface ExamTypesMasterTabProps {
  schoolId: number
  token: string
}

const emptyForm = {
  name: '',
  description: '',
  sort_order: '0',
  is_active: true,
}

export default function ExamTypesMasterTab({ schoolId, token }: ExamTypesMasterTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const headers = { Authorization: `Bearer ${token}` }
  const params = { school_id: schoolId }
  const queryKey = ['exam-types', schoolId]

  const { data: examTypes, isLoading } = useQuery(
    queryKey,
    async () => {
      const res = await axios.get(`${getApiUrl()}/exam-types`, { params, headers })
      return res.data.data
    },
    { enabled: !!schoolId && !!token }
  )

  const saveMutation = useMutation(
    async () => {
      const payload = {
        school_id: schoolId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      }
      if (editingId) {
        return axios.put(`${getApiUrl()}/exam-types/${editingId}`, payload, { headers })
      }
      return axios.post(`${getApiUrl()}/exam-types`, payload, { headers })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(queryKey)
        queryClient.invalidateQueries(['exam-types-active', schoolId])
        resetForm()
      },
      onError: (err: any) => {
        setError(err.response?.data?.error || 'Failed to save exam type')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const res = await axios.delete(`${getApiUrl()}/exam-types/${id}`, {
        params: { school_id: schoolId },
        headers,
      })
      return res.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(queryKey)
        queryClient.invalidateQueries(['exam-types-active', schoolId])
        if (data?.deactivated) {
          alert(data.message || 'Exam type deactivated because it is used in scheduled exams.')
        }
      },
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete exam type'),
    }
  )

  const sortedTypes = useMemo(
    () =>
      [...(examTypes || [])].sort((a: { sort_order?: number; name: string }, b: { sort_order?: number; name: string }) => {
        const orderA = a.sort_order ?? 0
        const orderB = b.sort_order ?? 0
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      }),
    [examTypes]
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
    setError('')
    setShowForm(false)
  }

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setError('')
    setForm({
      name: item.name,
      description: item.description || '',
      sort_order: String(item.sort_order ?? 0),
      is_active: !!item.is_active,
    })
    setShowForm(true)
  }

  return (
    <>
      <MasterDataTabShell
        title="Exam Types"
        subtitle={`${sortedTypes.length} type${sortedTypes.length === 1 ? '' : 's'}`}
        toolbarActions={
          <MasterDataToolbarBtn onClick={openAddForm}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Exam Type</span>
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
                  <th>Description</th>
                  <th className="text-center">Order</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedTypes.map((item: any) => (
                  <tr key={item.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0">
                      <span className="md-cell-text font-medium text-white" title={item.name}>
                        {item.name}
                      </span>
                    </td>
                    <td className="max-w-0">
                      <span className="md-cell-text text-white/70" title={item.description || undefined}>
                        {item.description || '—'}
                      </span>
                    </td>
                    <td className="text-center tabular-nums text-white/60">{item.sort_order ?? 0}</td>
                    <td className="text-center">
                      <MasterDataStatusTag active={item.is_active} label={item.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="md-action-link md-action-edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${item.name}"? If used in exams it will be deactivated.`)) {
                              deleteMutation.mutate(item.id)
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
            No exam types yet. Click <strong className="text-white/75">Add Exam Type</strong> to create one.
          </div>
        )}
      </MasterDataTabShell>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="modal-title">{editingId ? 'Edit Exam Type' : 'Add Exam Type'}</h3>
            {error && <p className="alert-error">{error}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!form.name.trim()) {
                  setError('Exam type name is required')
                  return
                }
                saveMutation.mutate()
              }}
              className="space-y-3"
            >
              <div>
                <label className="label-text mb-1">Type Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Unit Test, Mid Term, Final"
                  className="input-field"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label className="label-text mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional note for staff"
                  className="input-field"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="label-text mb-1">Display Order</label>
                <input
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  className="input-field"
                />
                <p className="text-xs text-white/50 mt-1">Lower numbers appear first in dropdowns.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-white/30"
                />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary btn-compact">
                  Cancel
                </button>
                <button type="submit" disabled={saveMutation.isLoading} className="btn-primary btn-compact">
                  {saveMutation.isLoading ? 'Saving…' : editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
