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

interface ExpensesMasterTabProps {
  schoolId: number
  token: string
}

export default function ExpensesMasterTab({ schoolId, token }: ExpensesMasterTabProps) {
  const queryClient = useQueryClient()

  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', is_active: true })

  const headers = { Authorization: `Bearer ${token}` }
  const params = { school_id: schoolId }

  const { data: categories, isLoading: categoriesLoading } = useQuery(
    ['expense-categories', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/expense-master/categories`, { params, headers })
      return res.data.data
    },
    { enabled: !!schoolId && !!token }
  )

  const saveCategoryMutation = useMutation(
    async () => {
      const payload = {
        school_id: schoolId,
        name: categoryForm.name.trim(),
        is_active: categoryForm.is_active,
      }
      if (editingCategoryId) {
        return axios.put(`${API_URL}/expense-master/categories/${editingCategoryId}`, payload, {
          headers,
        })
      }
      return axios.post(`${API_URL}/expense-master/categories`, payload, { headers })
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expense-categories', schoolId])
        resetCategoryForm()
        alert(editingCategoryId ? 'Category updated.' : 'Category added.')
      },
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to save category'),
    }
  )

  const deleteCategoryMutation = useMutation(
    async (id: number) => {
      await axios.delete(`${API_URL}/expense-master/categories/${id}`, {
        params: { school_id: schoolId },
        headers,
      })
    },
    {
      onSuccess: () => queryClient.invalidateQueries(['expense-categories', schoolId]),
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete category'),
    }
  )

  const sortedCategories = useMemo(
    () =>
      [...(categories || [])].sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [categories]
  )

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', is_active: true })
    setEditingCategoryId(null)
    setShowCategoryForm(false)
  }

  const startEditCategory = (row: any) => {
    setEditingCategoryId(row.id)
    setCategoryForm({
      name: row.name,
      is_active: !!row.is_active,
    })
    setShowCategoryForm(true)
  }

  return (
    <>
      <MasterDataTabShell
        title="Expense Categories"
        subtitle={`${sortedCategories.length} categor${sortedCategories.length === 1 ? 'y' : 'ies'}`}
        toolbarActions={
          <MasterDataToolbarBtn
            onClick={() => {
              if (showCategoryForm) resetCategoryForm()
              else setShowCategoryForm(true)
            }}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>{showCategoryForm ? 'Cancel' : 'Add Category'}</span>
          </MasterDataToolbarBtn>
        }
        footer={sortedCategories.length ? `Showing ${sortedCategories.length} records` : undefined}
      >
        {categoriesLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
        ) : sortedCategories.length ? (
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {sortedCategories.map((row: any) => (
                  <tr key={row.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0">
                      <span className="md-cell-text font-medium text-white" title={row.name}>
                        {row.name}
                      </span>
                    </td>
                    <td className="text-center">
                      <MasterDataStatusTag active={row.is_active} label={row.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditCategory(row)}
                          className="md-action-link md-action-edit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete category "${row.name}"?`)) {
                              deleteCategoryMutation.mutate(row.id)
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
            No categories yet. Click <strong className="text-white/75">Add Category</strong> to create one.
          </div>
        )}
      </MasterDataTabShell>

      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
            <h3 className="modal-title mb-4">
              {editingCategoryId ? 'Edit Category' : 'New Category'}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveCategoryMutation.mutate()
              }}
              className="space-y-3"
            >
              <div>
                <label className="label-text text-xs mb-1">Category Name *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="e.g. Utilities"
                  className="input-field"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-white/30"
                />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={resetCategoryForm} className="btn-secondary px-3 py-1.5 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveCategoryMutation.isLoading}
                  className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {editingCategoryId ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
