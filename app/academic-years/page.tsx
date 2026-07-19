'use client'

import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState } from 'react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function AcademicYearsPage() {
  const { user, token } = useAuth()
  const { academicYears, loadAcademicYears } = useAcademicYear()
  const [showForm, setShowForm] = useState(false)
  const [editingYear, setEditingYear] = useState<any>(null)
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
  })

  useQuery(
    ['academic-years', user?.school_id],
    async () => {
      const response = await axios.get(`${API_URL}/academic-years`, {
        params: { school_id: user?.school_id },
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    { enabled: !!user }
  )

  const createMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/academic-years`,
        { ...data, school_id: user?.school_id },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['academic-years', user?.school_id])
        loadAcademicYears()
        resetForm()
        alert('Academic year created successfully!')
      },
      onError: (error: any) => {
        alert(
          error.response?.data?.error ||
            error.response?.data?.errors?.[0]?.msg ||
            error.message ||
            'Failed to create academic year'
        )
      },
    }
  )

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(`${API_URL}/academic-years/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['academic-years', user?.school_id])
        loadAcademicYears()
        resetForm()
        alert('Academic year updated successfully!')
      },
      onError: (error: any) => {
        alert(
          error.response?.data?.error ||
            error.response?.data?.errors?.[0]?.msg ||
            error.message ||
            'Failed to update academic year'
        )
      },
    }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingYear) {
      updateMutation.mutate({ id: editingYear.id, data: formData })
    } else {
      if (!user?.school_id) {
        alert('School ID is required. Please ensure you are assigned to a school.')
        return
      }
      createMutation.mutate(formData)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const resetForm = () => {
    setFormData({ name: '', start_date: '', end_date: '', is_active: false })
    setEditingYear(null)
    setShowForm(false)
  }

  const handleEdit = (year: any) => {
    const formatDateForInput = (dateString: string) => {
      const date = new Date(dateString)
      const y = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${y}-${month}-${day}`
    }

    setEditingYear(year)
    setFormData({
      name: year.name || '',
      start_date: year.start_date ? formatDateForInput(year.start_date) : '',
      end_date: year.end_date ? formatDateForInput(year.end_date) : '',
      is_active: year.is_active || false,
    })
    setShowForm(true)
  }

  return (
    <Layout>
      <div className="page-container academic-years-page-layout gap-2">
        <div className="table-shell academic-years-page-shell flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 academic-years-toolbar">
            <div className="academic-years-unified-toolbar-row">
              <div className="academic-years-toolbar-meta shrink-0">
                <h1 className="text-sm font-semibold text-white leading-none">Academic Years</h1>
                <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                  {academicYears.length} year{academicYears.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="academic-years-toolbar-actions ml-auto pl-1 border-l border-white/10 shrink-0 flex items-center gap-1.5">
                <Link
                  href="/master-data/clone"
                  className="academic-years-toolbar-btn academic-years-toolbar-btn-secondary"
                >
                  Clone Data
                </Link>
                <button
                  type="button"
                  onClick={() => (showForm ? resetForm() : setShowForm(true))}
                  className="academic-years-toolbar-btn academic-years-toolbar-btn-primary"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{showForm ? 'Cancel' : 'New Year'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="academic-years-page-table flex-1 min-h-0 flex flex-col overflow-hidden">
            {academicYears.length > 0 ? (
              <>
                <div className="academic-years-table-scroll overflow-x-hidden flex-1 min-h-0">
                  <table className="data-table data-table-fit w-full">
                    <colgroup>
                      <col className="ay-col-year" />
                      <col className="ay-col-date" />
                      <col className="ay-col-date" />
                      <col className="ay-col-status" />
                      <col className="ay-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Start</th>
                        <th>End</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Act.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {academicYears.map((year) => (
                        <tr key={year.id} className="academic-years-table-row hover:bg-white/[0.04]">
                          <td className="ay-col-year max-w-0">
                            <span className="ay-cell-text font-medium text-white">{year.name}</span>
                          </td>
                          <td className="ay-col-date tabular-nums whitespace-nowrap">
                            {year.start_date
                              ? new Date(year.start_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="ay-col-date tabular-nums whitespace-nowrap">
                            {year.end_date
                              ? new Date(year.end_date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="ay-col-status text-center">
                            <span
                              className={
                                year.is_active
                                  ? 'academic-year-status-tag academic-year-status-tag--active'
                                  : 'academic-year-status-tag'
                              }
                            >
                              {year.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="ay-col-actions text-center">
                            <button
                              type="button"
                              onClick={() => handleEdit(year)}
                              className="text-[10px] font-semibold text-blue-300 hover:text-blue-200"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
                  Showing {academicYears.length} of {academicYears.length} years
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                No academic years found. Click <strong className="text-white/75">New Year</strong> to create one.
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
              <h2 className="modal-title mb-4">
                {editingYear ? 'Edit Academic Year' : 'Create Academic Year'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="label-text text-xs mb-1">
                    Academic Year Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 2026-27"
                    className="input-field input-field-compact w-full"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-text text-xs mb-1">
                      Start Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      required
                      className="input-field input-field-compact w-full"
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">
                      End Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      required
                      className="input-field input-field-compact w-full"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="h-3.5 w-3.5 rounded border-white/30"
                  />
                  Set as active academic year
                </label>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetForm} className="btn-secondary btn-compact">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="btn-primary btn-compact disabled:opacity-50"
                  >
                    {editingYear
                      ? updateMutation.isLoading
                        ? 'Updating…'
                        : 'Update'
                      : createMutation.isLoading
                        ? 'Creating…'
                        : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
