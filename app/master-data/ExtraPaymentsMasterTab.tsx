'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface ExtraPaymentsMasterTabProps {
  schoolId: number
  token: string
}

const emptyForm = {
  name: '',
  description: '',
  is_active: true,
}

export default function ExtraPaymentsMasterTab({ schoolId, token }: ExtraPaymentsMasterTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const headers = { Authorization: `Bearer ${token}` }
  const params = { school_id: schoolId }

  const { data: sources, isLoading } = useQuery(
    ['extra-payment-sources', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/extra-payment-master/sources`, { params, headers })
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
        is_active: form.is_active,
      }
      if (editingId) {
        return axios.put(`${API_URL}/extra-payment-master/sources/${editingId}`, payload, { headers })
      }
      return axios.post(`${API_URL}/extra-payment-master/sources`, payload, { headers })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['extra-payment-sources', schoolId])
        resetForm()
        alert(editingId ? 'Payment source updated.' : 'Payment source added.')
      },
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to save payment source'),
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await axios.delete(`${API_URL}/extra-payment-master/sources/${id}`, {
        params: { school_id: schoolId },
        headers,
      })
    },
    {
      onSuccess: () => queryClient.invalidateQueries(['extra-payment-sources', schoolId]),
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete payment source'),
    }
  )

  const sortedSources = useMemo(
    () =>
      [...(sources || [])].sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [sources]
  )

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (item: any) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      description: item.description || '',
      is_active: !!item.is_active,
    })
    setShowForm(true)
  }

  return (
    <>
      <MasterDataTabShell
        title="Collection Sources"
        subtitle={`${sortedSources.length} source${sortedSources.length === 1 ? '' : 's'}`}
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
            <span>{showForm ? 'Cancel' : 'Add Source'}</span>
          </MasterDataToolbarBtn>
        }
        footer={sortedSources.length ? `Showing ${sortedSources.length} records` : undefined}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
        ) : sortedSources.length ? (
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedSources.map((item: any) => (
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
                            if (confirm(`Delete "${item.name}"?`)) deleteMutation.mutate(item.id)
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
            No payment sources yet. Click <strong className="text-white/75">Add Source</strong> to create one.
          </div>
        )}
      </MasterDataTabShell>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
            <h3 className="modal-title mb-4">
              {editingId ? 'Edit Payment Source' : 'New Payment Source'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              className="space-y-3"
            >
              <div>
                <label className="label-text mb-1">Source Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Donation, Event Fee"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Optional description for this payment source"
                  className="input-field resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  id="source-active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-white/30"
                />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary px-3 py-1.5 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!form.name.trim() || saveMutation.isLoading}
                  className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {saveMutation.isLoading ? 'Saving…' : editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
