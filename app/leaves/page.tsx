'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect } from 'react'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterBar,
  PageFilterField,
  PageFilterRow,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { fetchLeaveTypes } from '@/lib/leaveTypesApi'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function LeavesPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { scopedHeaders, branchScopeKey } = useBranchYearScope()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingLeave, setEditingLeave] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')

  const [formData, setFormData] = useState({
    staff_id: '',
    leave_type: '',
    start_date: '',
    end_date: '',
    days_count: '',
    reason: '',
  })

  const { data: leaveTypes } = useQuery(
    ['leave-types-active', user?.school_id, academicYear?.id],
    () =>
      fetchLeaveTypes(
        token!,
        Number(user!.school_id),
        Number(academicYear!.id),
        true
      ),
    { enabled: !!user?.school_id && !!academicYear?.id && !!token }
  )

  const activeLeaveTypes = leaveTypes || []

  const selectedLeaveTypeMeta = activeLeaveTypes.find((t) => t.name === formData.leave_type)
  const isHalfDayLeaveType = !!selectedLeaveTypeMeta?.is_half_day_type

  // Fetch staff/teachers (for admin view)
  const { data: staff } = useQuery(
    ['staff', user?.school_id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/users`, {
        params: {
          school_id: user?.school_id,
        },
        headers: scopedHeaders,
      })
      return response.data.data?.filter((u: any) =>
        ['Teacher', 'Principal', 'School Admin'].includes(u.role_name)
      ) || []
    },
    { enabled: !!user && !!token && (user?.role_name === 'Super Admin' || user?.role_name === 'School Admin') }
  )

  const canFilterLeaves =
    user?.role_name === 'Principal' || user?.role_name === 'School Admin'

  // Fetch leaves
  const { data: leaves, refetch: refetchLeaves } = useQuery(
    ['leaves', user?.school_id, academicYear?.id, statusFilter, branchScopeKey],
    async () => {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
      }

      // Teachers can only see their own leaves
      // Principal and School Admin can see all leaves
      if (user?.role_name !== 'Super Admin' && user?.role_name !== 'School Admin' && user?.role_name !== 'Principal') {
        params.staff_id = user?.id
      }

      if (canFilterLeaves && statusFilter !== 'all') {
        params.status = statusFilter
      }

      const response = await axios.get(`${API_URL}/leaves`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear }
  )

  // Check if user can approve leaves (Principal or School Admin only)
  const canApproveLeaves = user?.role_name === 'Principal' || user?.role_name === 'School Admin' || user?.role_name === 'Super Admin'

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Leave Applications',
      filename: 'leaves',
      getSubtitle: () =>
        statusFilter !== 'all' ? `Status: ${statusFilter}` : undefined,
      columns: [
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'leave_type', label: 'Leave Type' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'days_count', label: 'Days' },
        { key: 'status', label: 'Status' },
        { key: 'approved_by_name', label: 'Approved By' },
        { key: 'reason', label: 'Reason' },
      ],
      getRows: () =>
        (leaves || []).map((l: any) => ({
          staff_name: l.staff_name || '',
          leave_type: l.leave_type || '',
          start_date: l.start_date || '',
          end_date: l.end_date || '',
          days_count: l.days_count ?? '',
          status: l.status || '',
          approved_by_name: l.approved_by_name || '',
          reason: l.reason || '',
        })),
    },
  })

  // Check if user is a teacher (can only apply, not approve)
  const isTeacher = user?.role_name === 'Teacher'

  // Calculate days count automatically
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.end_date)

      if (end >= start) {
        // Calculate difference in days
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 to include both start and end days

        // If half day type, subtract 0.5
        if (isHalfDayLeaveType) {
          setFormData((prev) => ({
            ...prev,
            days_count: (diffDays - 0.5).toFixed(1),
          }))
        } else {
          setFormData((prev) => ({
            ...prev,
            days_count: diffDays.toFixed(1),
          }))
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          days_count: '',
        }))
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        days_count: '',
      }))
    }
  }, [formData.start_date, formData.end_date, formData.leave_type, isHalfDayLeaveType])

  useEffect(() => {
    if (!activeLeaveTypes.length) return
    const names = activeLeaveTypes.map((t) => t.name)
    if (!formData.leave_type || !names.includes(formData.leave_type)) {
      setFormData((prev) => ({ ...prev, leave_type: activeLeaveTypes[0].name }))
    }
  }, [activeLeaveTypes, formData.leave_type])

  // Set staff_id to current user if not admin
  useEffect(() => {
    if (!showForm) return

    if (user?.role_name !== 'Super Admin' && user?.role_name !== 'School Admin' && user?.role_name !== 'Principal') {
      setFormData((prev) => ({
        ...prev,
        staff_id: String(user?.id || ''),
      }))
      setSelectedStaffId(String(user?.id || ''))
    }
  }, [showForm, user])

  // Create leave mutation
  const createMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/leaves`,
        {
          ...data,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          staff_id: data.staff_id || user?.id,
        },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['leaves', user?.school_id, academicYear?.id])
        refetchLeaves()
        resetForm()
        alert('Leave application submitted successfully!')
      },
      onError: (error: any) => {
        console.error('Apply leave error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to submit leave application'
        alert(errorMessage)
      },
    }
  )

  // Update leave mutation
  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${API_URL}/leaves/${id}`,
        {
          ...data,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['leaves', user?.school_id, academicYear?.id])
        refetchLeaves()
        resetForm()
        alert('Leave updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update leave error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to update leave'
        alert(errorMessage)
      },
    }
  )

  // Delete leave mutation
  const deleteMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/leaves/${id}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['leaves', user?.school_id, academicYear?.id])
        refetchLeaves()
        alert('Leave deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete leave error:', error)
        const errorMessage =
          error.response?.data?.error || error.message || 'Failed to delete leave'
        alert(errorMessage)
      },
    }
  )

  // Approve/Reject leave mutation
  const approveMutation = useMutation(
    async ({ id, status, remarks }: { id: number; status: string; remarks?: string }) => {
      const response = await axios.put(
        `${API_URL}/leaves/${id}/approve`,
        {
          status,
          remarks: remarks || null,
        },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries(['leaves', user?.school_id, academicYear?.id])
        refetchLeaves()
        if (data?.data?.sanctioned) {
          alert('Leave approved and sanctioned successfully! The leave is now active.')
        } else {
          alert('Leave rejected successfully.')
        }
      },
      onError: (error: any) => {
        console.error('Approve leave error:', error)
        const errorMessage =
          error.response?.data?.error || error.message || 'Failed to update leave status'
        alert(errorMessage)
      },
    }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.leave_type || !formData.start_date || !formData.end_date || !formData.days_count) {
      alert('Please fill in all required fields')
      return
    }

    if (parseFloat(formData.days_count) <= 0) {
      alert('Days count must be greater than 0')
      return
    }

    const payload = {
      leave_type: formData.leave_type,
      start_date: formData.start_date,
      end_date: formData.end_date,
      days_count: parseFloat(formData.days_count),
      reason: formData.reason || null,
      staff_id: editingLeave ? undefined : (formData.staff_id || user?.id),
    }

    if (editingLeave) {
      updateMutation.mutate({ id: editingLeave.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleEdit = async (leave: any) => {
    try {
      const response = await axios.get(`${API_URL}/leaves/${leave.id}`, {
        headers: scopedHeaders,
      })

      const leaveData = response.data.data
      const staffMember = staff?.find((s: any) => s.id === leaveData.staff_id)

      if (staffMember) {
        setSelectedStaffId(String(staffMember.id))
      }

      setFormData({
        staff_id: String(leaveData.staff_id || ''),
        leave_type: leaveData.leave_type || activeLeaveTypes[0]?.name || '',
        start_date: formatDateForInput(leaveData.start_date),
        end_date: formatDateForInput(leaveData.end_date),
        days_count: String(leaveData.days_count || ''),
        reason: leaveData.reason || '',
      })

      setEditingLeave(leaveData)
      setShowForm(true)
    } catch (error: any) {
      console.error('Error fetching leave:', error)
      alert('Failed to load leave for editing')
    }
  }

  const handleDelete = (leave: any) => {
    if (
      confirm(
        `Are you sure you want to delete this leave application?\n\nLeave Type: ${leave.leave_type}\nDates: ${new Date(leave.start_date).toLocaleDateString()} - ${new Date(leave.end_date).toLocaleDateString()}\n\nThis action cannot be undone.`
      )
    ) {
      deleteMutation.mutate(leave.id)
    }
  }

  const handleApprove = (leave: any) => {
    const remarks = prompt('Enter approval remarks (optional):\n\nNote: Once approved, this leave will be sanctioned and cannot be edited.')
    if (remarks !== null) {
      approveMutation.mutate({ id: leave.id, status: 'Approved', remarks })
    }
  }

  const handleReject = (leave: any) => {
    const remarks = prompt('Enter rejection remarks (required):')
    if (remarks && remarks.trim()) {
      approveMutation.mutate({ id: leave.id, status: 'Rejected', remarks })
    } else if (remarks !== null) {
      alert('Rejection remarks are required')
    }
  }

  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString
      }
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return ''
      }
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }

  const resetForm = () => {
    setFormData({
      staff_id: '',
      leave_type: activeLeaveTypes[0]?.name || '',
      start_date: '',
      end_date: '',
      days_count: '',
      reason: '',
    })
    setSelectedStaffId('')
    setEditingLeave(null)
    setShowForm(false)
  }

  const canApprove = (leave: any) => {
    // Only Principal or School Admin can approve leaves
    return (
      leave.status === 'Pending' &&
      canApproveLeaves
    )
  }

  const canEdit = (leave: any) => {
    if (leave.status === 'Approved' || leave.status === 'Rejected') {
      return false
    }
    return (
      leave.staff_id === user?.id ||
      user?.role_name === 'Super Admin' ||
      user?.role_name === 'School Admin'
    )
  }

  const canDelete = (leave: any) => {
    if (leave.status === 'Approved' || leave.status === 'Rejected') {
      return false
    }
    return (
      leave.staff_id === user?.id ||
      user?.role_name === 'Super Admin' ||
      user?.role_name === 'School Admin'
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'badge-success'
      case 'Rejected':
        return 'badge-danger'
      case 'Pending':
        return 'badge-warning'
      case 'Cancelled':
        return 'inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200'
      default:
        return 'inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200'
    }
  }


  return (
    <Layout>
      <div className="page-container">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="page-title">Leave Management</h1>
            <p className="page-subtitle">
              {isTeacher
                ? 'Apply for leave - Approval required from Principal or School Admin'
                : canApproveLeaves
                ? 'Manage leave applications - Approve or reject leave requests'
                : 'Apply and manage leaves'}
            </p>
            {isTeacher && (
              <p className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Your leave will be pending until approved by Principal or School Admin.
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (showForm) {
                resetForm()
              } else {
                setShowForm(true)
              }
            }}
            className="btn-primary self-start shrink-0"
          >
            {showForm ? 'Cancel' : 'Apply for Leave'}
          </button>
        </div>

        {/* Leave Application Form */}
        {showForm && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">
              {editingLeave ? 'Edit Leave Application' : 'Apply for Leave'}
            </h2>
            {!editingLeave && (
              <div className="alert-info mb-4">
                <p>
                  <strong>Note:</strong> After submitting, your leave application will be pending approval.
                  Only Principal or School Admin can approve your leave. Once approved, your leave will be
                  sanctioned.
                </p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {canApproveLeaves && !editingLeave && (
                <div>
                  <label htmlFor="staff_id" className="label-text">
                    Staff Member <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="staff_id"
                    name="staff_id"
                    value={formData.staff_id}
                    onChange={(e) => {
                      handleChange(e)
                      setSelectedStaffId(e.target.value)
                    }}
                    required
                    disabled={!!editingLeave}
                    className="select-field w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="" disabled hidden>
                      Select staff member
                    </option>
                    {staff?.map((staffMember: any) => (
                      <option key={staffMember.id} value={staffMember.id}>
                        {staffMember.name} - {staffMember.role_name}
                      </option>
                    ))}
                  </SelectField>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative z-20">
                  <label htmlFor="leave_type" className="label-text">
                    Leave Type <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="leave_type"
                    name="leave_type"
                    value={formData.leave_type}
                    onChange={handleChange}
                    required
                    disabled={!activeLeaveTypes.length}
                    className="select-field w-full"
                  >
                    {!activeLeaveTypes.length && (
                      <option value="">No leave types configured</option>
                    )}
                    {activeLeaveTypes.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                        {t.annual_quota > 0 ? ` (${t.annual_quota} days/year)` : ''}
                        {!t.is_paid ? ' — Unpaid' : ''}
                      </option>
                    ))}
                  </SelectField>
                  {!activeLeaveTypes.length && (
                    <p className="text-xs text-amber-700 mt-1">
                      Ask School Admin to configure leave types in Master Data → Leave.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="days_count" className="label-text">
                    Days Count <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    id="days_count"
                    name="days_count"
                    value={formData.days_count}
                    onChange={handleChange}
                    required
                    min="0.5"
                    step="0.5"
                    placeholder="Auto-calculated"
                    readOnly
                    className="input-field placeholder-slate-400 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Automatically calculated from dates
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_date" className="label-text">
                    Start Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 input-field text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="end_date" className="label-text">
                    End Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    required
                    min={formData.start_date}
                    className="w-full px-4 py-2 input-field text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reason" className="label-text">
                  Reason
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter reason for leave (optional)"
                  className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {editingLeave
                    ? updateMutation.isLoading
                      ? 'Updating...'
                      : 'Update Leave'
                    : createMutation.isLoading
                    ? 'Submitting...'
                    : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Pending Leaves Alert for Approvers */}
        {!showForm && canApproveLeaves && (
          <div className="glass-card p-4 bg-amber-50 border border-amber-200">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-amber-800 ">
                <strong>Action Required:</strong> You have {leaves?.filter((l: any) => l.status === 'Pending').length || 0} pending leave application(s) waiting for your approval.
              </p>
            </div>
          </div>
        )}

        {/* Filters — School Admin & Principal only */}
        {!showForm && canFilterLeaves && (
          <PageFilterBar error={exportError}>
            <PageFilterRow>
              <PageFilterField id="status_filter" label="Status">
                <SelectField
                  id="status_filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select-field"
                >
                  <option value="all">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                </SelectField>
              </PageFilterField>

              <PageFilterActions>
                <ExportMenu
                  onExport={handleExport}
                  isExporting={isExporting}
                  recordCount={(leaves || []).length}
                />
              </PageFilterActions>
            </PageFilterRow>
          </PageFilterBar>
        )}

        {!showForm && !canFilterLeaves && (
          <div className="flex justify-end">
            <ExportMenu
              onExport={handleExport}
              isExporting={isExporting}
              recordCount={(leaves || []).length}
            />
            {exportError && (
              <p className="mt-2 text-xs text-red-600 w-full text-right" role="alert">
                {exportError}
              </p>
            )}
          </div>
        )}

        {/* Leaves Table */}
        {!showForm && (
          <div className="glass-card overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                  <tr>
                    {canApproveLeaves && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Staff Name</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Leave Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    {canApproveLeaves && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Approved By</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves?.map((leave: any) => (
                  <tr 
                    key={leave.id} 
                    className={`hover:bg-slate-50 transition-colors ${
                      leave.status === 'Pending' && canApproveLeaves ? 'bg-yellow-500/5 border-l-2 border-yellow-400' : ''
                    }`}
                  >
                    {canApproveLeaves && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                        {leave.staff_name}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {leave.leave_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                      {new Date(leave.start_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                      {new Date(leave.end_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {parseFloat(leave.days_count).toFixed(1)} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(leave.status)}`}>
                        {leave.status === 'Approved' ? '✓ Sanctioned' : leave.status}
                      </span>
                      {leave.status === 'Approved' && (
                        <p className="text-xs text-green-700 mt-1">Leave is sanctioned</p>
                      )}
                      {leave.status === 'Pending' && (
                        <p className="text-xs text-amber-700 mt-1">Awaiting approval</p>
                      )}
                    </td>
                    {canApproveLeaves && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {leave.approved_by_name ? (
                          <span className="text-green-700">✓ {leave.approved_by_name}</span>
                        ) : (
                          <span className="text-amber-700">Pending approval</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {canApprove(leave) && (
                          <>
                            <button
                              onClick={() => handleApprove(leave)}
                              disabled={approveMutation.isLoading}
                              className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Approve and sanction leave"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleReject(leave)}
                              disabled={approveMutation.isLoading}
                              className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reject leave application"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </>
                        )}
                        {canEdit(leave) && (
                          <button
                            onClick={() => handleEdit(leave)}
                            className="text-primary-600 hover:text-primary-800 transition-colors"
                            title="Edit leave"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        )}
                        {canDelete(leave) && (
                          <button
                            onClick={() => handleDelete(leave)}
                            disabled={deleteMutation.isLoading}
                            className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete leave"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!leaves || leaves.length === 0) && (
              <div className="text-center py-12 text-slate-500 ">
                No leaves found.{' '}
                {canFilterLeaves && statusFilter !== 'all' && 'Try changing the status filter or '}
                Apply for a leave to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
