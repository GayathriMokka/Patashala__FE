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

interface AssetsMasterTabProps {
  schoolId: number
  token: string
}

const emptyForm = {
  name: '',
  description: '',
  is_active: true,
}

export default function AssetsMasterTab({ schoolId, token }: AssetsMasterTabProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const headers = { Authorization: `Bearer ${token}` }
  const params = { school_id: schoolId }

  const { data: assetNames, isLoading } = useQuery(
    ['asset-names', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/asset-master/names`, { params, headers })
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
        return axios.put(`${API_URL}/asset-master/names/${editingId}`, payload, { headers })
      }
      return axios.post(`${API_URL}/asset-master/names`, payload, { headers })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['asset-names', schoolId])
        resetForm()
      },
      onError: (err: any) => {
        setError(err.response?.data?.error || 'Failed to save asset name')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await axios.delete(`${API_URL}/asset-master/names/${id}`, {
        params: { school_id: schoolId },
        headers,
      })
    },
    {
      onSuccess: () => queryClient.invalidateQueries(['asset-names', schoolId]),
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete asset name'),
    }
  )

  const sortedNames = useMemo(
    () =>
      [...(assetNames || [])].sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [assetNames]
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
      is_active: !!item.is_active,
    })
    setShowForm(true)
  }

  return (
    <>
      <MasterDataTabShell
        title="Asset Names"
        subtitle={`${sortedNames.length} type${sortedNames.length === 1 ? '' : 's'}`}
        toolbarActions={
          <MasterDataToolbarBtn onClick={openAddForm}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Asset Name</span>
          </MasterDataToolbarBtn>
        }
        footer={sortedNames.length ? `Showing ${sortedNames.length} records` : undefined}
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
        ) : sortedNames.length ? (
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
                {sortedNames.map((item: any) => (
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
            No asset names yet. Click <strong className="text-white/75">Add Asset Name</strong> to create one.
          </div>
        )}
      </MasterDataTabShell>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div
            className="glass-card p-5 w-full max-w-md shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-name-form-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="asset-name-form-title" className="modal-title">
                {editingId ? 'Edit Asset Name' : 'Add Asset Name'}
              </h3>
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

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              className="space-y-3"
            >
              <div>
                <label className="label-text mb-1">Asset Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Computer, Desk, Chair"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-text mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                  className="input-field"
                />
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
