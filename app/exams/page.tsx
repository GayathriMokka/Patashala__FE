'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState } from 'react'
import ExportMenu from '@/components/ExportMenu'
import { PageFilterActions, PageFilterField } from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { fetchExamTypes, getExamTypeBadgeClass } from '@/lib/examTypes'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

function IconPencil({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function IconTrash({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function getExamStatus(startDate: Date, endDate: Date) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  if (start > now) return 'upcoming'
  if (end < now) return 'past'
  return 'ongoing'
}

function ExamStatusBadge({ status }: { status: 'upcoming' | 'ongoing' | 'past' }) {
  if (status === 'upcoming') {
    return <span className="exam-status-upcoming">Soon</span>
  }
  if (status === 'ongoing') {
    return <span className="exam-status-ongoing">Live</span>
  }
  return <span className="exam-status-past">Done</span>
}

export default function ExamsPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { scopedHeaders, branchScopeKey } = useBranchYearScope()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingExam, setEditingExam] = useState<any>(null)
  const [filterClassId, setFilterClassId] = useState<string>('')
  const [filterExamName, setFilterExamName] = useState<string>('')

  const [formData, setFormData] = useState({
    exam_type: '',
    class_id: '',
    start_date: '',
    end_date: '',
    description: '',
  })

  const getExamDisplayName = (exam: { name?: string; exam_type?: string }) =>
    exam.exam_type || exam.name || '—'

  const { data: classes } = useQuery(
    ['classes', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/classes`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear }
  )

  const { data: examTypes } = useQuery(
    ['exam-types-active', user?.school_id],
    () => fetchExamTypes(token!, Number(user!.school_id), true),
    { enabled: !!user && !!token }
  )

  const activeExamTypeNames = examTypes?.map((t) => t.name) || []

  const { data: exams, refetch, isLoading } = useQuery(
    ['exams', user?.school_id, academicYear?.id, branchScopeKey, filterClassId],
    async () => {
      const response = await axios.get(`${API_URL}/exams`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          class_id: filterClassId || undefined,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear }
  )

  const filteredExams = exams?.filter((exam: any) => {
    if (filterExamName && getExamDisplayName(exam) !== filterExamName) return false
    return true
  }) || []

  const buildExamPayload = (data: typeof formData) => ({
    ...data,
    name: data.exam_type,
    exam_type: data.exam_type,
  })

  const createMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/exams`,
        {
          ...data,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        { headers: scopedHeaders }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['exams', user?.school_id, academicYear?.id])
        refetch()
        resetForm()
        alert('Exam scheduled successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || error.message || 'Failed to schedule exam')
      },
    }
  )

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${API_URL}/exams/${id}`,
        {
          ...data,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        { headers: scopedHeaders }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['exams', user?.school_id, academicYear?.id])
        refetch()
        resetForm()
        alert('Exam updated successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || error.message || 'Failed to update exam')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/exams/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['exams', user?.school_id, academicYear?.id])
        refetch()
        alert('Exam deleted successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || error.message || 'Failed to delete exam')
      },
    }
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!academicYear) {
      alert('Please select an academic year first.')
      return
    }
    if (!user?.school_id) {
      alert('School ID is required.')
      return
    }
    if (!formData.exam_type || !formData.start_date || !formData.end_date) {
      alert('Please fill in all required fields.')
      return
    }
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      alert('End date must be after start date.')
      return
    }

    const payload = buildExamPayload(formData)

    if (editingExam) {
      updateMutation.mutate({ id: editingExam.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const resetForm = () => {
    setFormData({
      exam_type: '',
      class_id: '',
      start_date: '',
      end_date: '',
      description: '',
    })
    setEditingExam(null)
    setShowForm(false)
  }

  const handleEdit = (exam: any) => {
    setEditingExam(exam)
    setFormData({
      exam_type: exam.exam_type || exam.name || '',
      class_id: exam.class_id || '',
      start_date: exam.start_date ? exam.start_date.split('T')[0] : '',
      end_date: exam.end_date ? exam.end_date.split('T')[0] : '',
      description: exam.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = (exam: any) => {
    if (window.confirm(`Delete exam "${getExamDisplayName(exam)}"? This cannot be undone.`)) {
      deleteMutation.mutate(exam.id)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDateShort = (dateString: string) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    })
  }

  const getDurationDays = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Examinations',
      filename: 'exams',
      getSubtitle: () => {
        const parts: string[] = []
        if (filterClassId) {
          const cls = classes?.find((c: any) => String(c.id) === filterClassId)
          if (cls) parts.push(`Class: ${cls.name}`)
        }
        if (filterExamName) parts.push(`Exam: ${filterExamName}`)
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'exam_name', label: 'Exam Name' },
        { key: 'class_name', label: 'Class' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'duration_days', label: 'Duration (days)' },
        { key: 'description', label: 'Description' },
      ],
      getRows: () =>
        filteredExams.map((exam: any) => ({
          exam_name: getExamDisplayName(exam),
          class_name: exam.class_name || '',
          start_date: formatDate(exam.start_date),
          end_date: formatDate(exam.end_date),
          duration_days: getDurationDays(exam.start_date, exam.end_date),
          description: exam.description || '',
        })),
    },
  })

  return (
    <Layout>
      <div className="page-container exams-page-layout gap-2">
        <div className="table-shell exams-page-shell flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 exams-toolbar">
            <div className="exams-unified-toolbar-row">
              <div className="exams-toolbar-meta shrink-0">
                <h1 className="text-sm font-semibold text-white leading-none">Examinations</h1>
                <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                  {filteredExams.length} / {exams?.length ?? 0} exams
                </p>
              </div>

              <div className="exams-toolbar-divider" aria-hidden />

              <PageFilterField label="Class" hideLabel className="exams-toolbar-select">
                <SelectField
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="w-full input-field select-field"
                  aria-label="Filter by class"
                >
                  <option value="">Class</option>
                  {classes?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </SelectField>
              </PageFilterField>

              <PageFilterField label="Exam" hideLabel className="exams-toolbar-select">
                <SelectField
                  value={filterExamName}
                  onChange={(e) => setFilterExamName(e.target.value)}
                  className="w-full input-field select-field"
                  aria-label="Filter by exam name"
                >
                  <option value="">Exam</option>
                  {activeExamTypeNames.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </SelectField>
              </PageFilterField>

              <PageFilterActions className="exams-toolbar-actions pb-0">
                <ExportMenu
                  onExport={handleExport}
                  isExporting={isExporting}
                  recordCount={filteredExams.length}
                  size="sm"
                />
                <button
                  type="button"
                  onClick={() => (showForm ? resetForm() : setShowForm(true))}
                  className="exams-toolbar-btn exams-toolbar-btn-primary"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{showForm ? 'Cancel' : 'Schedule'}</span>
                </button>
              </PageFilterActions>
            </div>
            {exportError ? (
              <p className="mt-1 text-[11px] text-red-200" role="alert">
                {exportError}
              </p>
            ) : null}
          </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
              <h2 className="modal-title mb-4">
                {editingExam ? 'Edit Exam' : 'Schedule New Exam'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-text text-xs mb-1">
                      Exam Name <span className="text-red-400">*</span>
                    </label>
                    <SelectField
                      name="exam_type"
                      value={formData.exam_type}
                      onChange={handleChange}
                      required
                      className="input-field input-field-compact select-field"
                    >
                      <option value="">Select Exam Name</option>
                      {activeExamTypeNames.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </SelectField>
                    {activeExamTypeNames.length === 0 && (
                      <p className="text-xs text-amber-300 mt-1">
                        Add exam names in Master Data → Exam Types.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Class</label>
                    <SelectField
                      name="class_id"
                      value={formData.class_id}
                      onChange={handleChange}
                      className="input-field input-field-compact select-field"
                    >
                      <option value="">All Classes</option>
                      {classes?.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
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
                      min={formData.start_date}
                      className="input-field input-field-compact w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text text-xs mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Optional notes…"
                    className="input-field input-field-compact resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetForm} className="btn-secondary btn-compact">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="btn-primary btn-compact disabled:opacity-50"
                  >
                    {createMutation.isLoading || updateMutation.isLoading
                      ? editingExam
                        ? 'Updating…'
                        : 'Scheduling…'
                      : editingExam
                        ? 'Update Exam'
                        : 'Schedule Exam'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="exams-page-table flex-1 min-h-0 flex flex-col overflow-hidden">
          {isLoading ? (
            <p className="flex-1 flex items-center justify-center text-xs text-white/55">Loading exams…</p>
          ) : filteredExams.length > 0 ? (
            <>
              <div className="exams-table-scroll overflow-x-hidden">
                <table className="data-table data-table-fit exams-dense-table w-full">
                  <colgroup>
                    <col className="exam-col-name" />
                    <col className="exam-col-class" />
                    <col className="exam-col-period" />
                    <col className="exam-col-duration" />
                    <col className="exam-col-status" />
                    <col className="exam-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="exam-col-name">Exam</th>
                      <th className="exam-col-class">Class</th>
                      <th className="exam-col-period">Period</th>
                      <th className="exam-col-duration">Dur.</th>
                      <th className="exam-col-status">Status</th>
                      <th className="exam-col-actions text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredExams.map((exam: any) => {
                      const duration = getDurationDays(exam.start_date, exam.end_date)
                      const status = getExamStatus(
                        new Date(exam.start_date),
                        new Date(exam.end_date)
                      )
                      const examLabel = getExamDisplayName(exam)

                      return (
                        <tr key={exam.id} className="exams-table-row hover:bg-white/[0.04]">
                          <td className="exam-col-name max-w-0">
                            <span
                              className={`inline-flex max-w-full px-1.5 py-px text-[9px] font-semibold rounded border truncate ${getExamTypeBadgeClass(examLabel)}`}
                              title={exam.description ? `${examLabel} — ${exam.description}` : examLabel}
                            >
                              {examLabel}
                            </span>
                          </td>
                          <td className="exam-col-class max-w-0">
                            <span className="exam-cell-text" title={exam.class_name || 'All Classes'}>
                              {exam.class_name || 'All'}
                            </span>
                          </td>
                          <td className="exam-col-period max-w-0 whitespace-nowrap">
                            <span
                              className="exam-cell-text text-[10px] tabular-nums"
                              title={`${formatDate(exam.start_date)} – ${formatDate(exam.end_date)}`}
                            >
                              {formatDateShort(exam.start_date)} – {formatDateShort(exam.end_date)}
                            </span>
                          </td>
                          <td className="exam-col-duration text-center">
                            <span className="exam-cell-text tabular-nums">{duration}d</span>
                          </td>
                          <td className="exam-col-status">
                            <ExamStatusBadge status={status} />
                          </td>
                          <td className="exam-col-actions">
                            <div className="flex items-center justify-center gap-px">
                              <button
                                type="button"
                                onClick={() => handleEdit(exam)}
                                className="p-1 text-blue-300 hover:bg-white/10 rounded"
                                title="Edit"
                              >
                                <IconPencil />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(exam)}
                                className="p-1 text-red-300 hover:bg-white/10 rounded"
                                title="Delete"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
                Showing {filteredExams.length} of {exams?.length ?? 0} exams
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
              No exams scheduled. Click <strong className="text-white/75">Schedule</strong> to add one.
            </div>
          )}
        </div>
        </div>
      </div>
    </Layout>
  )
}
