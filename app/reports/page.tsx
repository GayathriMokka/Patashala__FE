'use client'

import SelectField from '@/components/SelectField'
import SingleSelectDropdown from '@/components/SingleSelectDropdown'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useUrlQueryStateNullable } from '@/lib/useUrlQueryState'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useRef, useMemo } from 'react'
import { canViewRevenue } from '@/lib/revenueAccess'
import { formatMoney } from '@/lib/formatMoney'
import ExportMenu from '@/components/ExportMenu'
import DropdownPanelPortal from '@/components/DropdownPanelPortal'
import { useClickOutside } from '@/lib/useFloatingPanel'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

const REVENUE_PAYMENT_MODES = ['Cash', 'Cheque', 'UPI', 'Card', 'Net Banking'] as const

const REVENUE_COLLECTION_TYPES = [
  { value: '', label: 'All types' },
  { value: 'payments', label: 'Payments' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
] as const

function formatReportPaymentMode(method?: string | null) {
  if (!method) return '—'
  if (method === 'Bank Transfer') return 'Net Banking'
  if (method === 'Online') return 'Card'
  return method
}

function formatReportTxDate(raw: unknown) {
  if (!raw) return '—'
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getRevenueCollectionLabels(collectionType?: string) {
  const type = String(collectionType || 'all').toLowerCase()
  if (type === 'pending') {
    return {
      total: 'Total Pending',
      column: 'Total Pending',
      count: 'Records',
    }
  }
  if (type === 'refunded') {
    return {
      total: 'Total Refunded',
      column: 'Total Refunded',
      count: 'Refunds',
    }
  }
  return {
    total: 'Total Collected',
    column: 'Total Collected',
    count: 'Records',
  }
}

const REPORT_TYPES_ALL = ['attendance', 'academic', 'revenue', 'expense', 'student'] as const
const ATTENDANCE_VIEWS = ['students', 'teachers'] as const
type AttendanceView = (typeof ATTENDANCE_VIEWS)[number]

function formatStaffWorkHours(minutes?: number | null) {
  const total = Number(minutes) || 0
  if (total <= 0) return '—'
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

function attendanceStatusClass(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'present') return 'text-emerald-200'
  if (s === 'absent') return 'text-red-300'
  if (s === 'late') return 'text-amber-200'
  if (s === 'excused') return 'text-blue-200'
  if (s === 'half day') return 'text-violet-200'
  return 'text-white/70'
}

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatReportMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  if (!year || !month) return monthKey
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function formatReportDateDisplay(value?: string | null) {
  if (!value) return '—'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatReportTimeDisplay(value?: string | null) {
  if (!value) return '—'
  const str = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const d = new Date(str.includes('T') ? str : str.replace(' ', 'T'))
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    }
  }
  if (/^\d{2}:\d{2}/.test(str)) {
    const [h, m] = str.slice(0, 5).split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return str
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function downloadExportBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { branchScopeKey, branchLabel, scopedHeaders } = useBranchYearScope()
  const showRevenueReports = canViewRevenue(user?.role_name)
  const availableReportTypes = REPORT_TYPES_ALL.filter(
    (t) => t !== 'revenue' || showRevenueReports
  )
  const [activeReport, setActiveReport] = useUrlQueryStateNullable(
    'report',
    availableReportTypes as unknown as string[]
  )
  const [showBatchExport, setShowBatchExport] = useState(false)
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('students')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuAnchorRef = useRef<HTMLDivElement>(null)
  const exportMenuPanelRef = useRef<HTMLDivElement>(null)
  const [showExportPreview, setShowExportPreview] = useState(false)
  const [selectedExportFormat, setSelectedExportFormat] = useState<string>('csv')
  const [isExporting, setIsExporting] = useState<'excel' | 'pdf' | 'csv' | 'json' | null>(null)
  const [exportPreviewData, setExportPreviewData] = useState<any>(null)
  const [expenseSearchTerm, setExpenseSearchTerm] = useState('')

  const [filters, setFilters] = useState<any>({
    start_date: '',
    end_date: '',
    class_id: '',
    section_id: '',
    staff_id: '',
    student_id: '',
    exam_id: '',
    category: '',
    payment_mode: '',
    collection_type: '',
  })

  useEffect(() => {
    if (!showRevenueReports && activeReport === 'revenue') {
      setActiveReport(null)
    }
  }, [showRevenueReports, activeReport])

  useEffect(() => {
    if (activeReport !== 'attendance') return
    const today = todayIsoDate()
    setFilters((prev: any) => {
      if (prev.start_date && prev.end_date) return prev
      return {
        ...prev,
        start_date: prev.start_date || today,
        end_date: prev.end_date || today,
      }
    })
  }, [activeReport, attendanceView])

  // Fetch classes for filters
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

  const sortedClasses = useMemo(() => {
    return [...(classes || [])].sort((a: { level?: number; name: string }, b: { level?: number; name: string }) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      if (levelA !== levelB) return levelA - levelB
      return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
    })
  }, [classes])

  // Fetch sections for filters
  const { data: sections } = useQuery(
    ['sections', filters.class_id],
    async () => {
      if (!filters.class_id) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          class_id: filters.class_id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!filters.class_id }
  )

  // Fetch exams for filters
  const { data: exams } = useQuery(
    ['exams', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/exams`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeReport === 'academic' }
  )

  // Student Attendance Report (day-wise)
  const { data: studentAttendancePayload, isLoading: attendanceLoading } = useQuery(
    ['attendance-report', user?.school_id, academicYear?.id, branchScopeKey, filters],
    async () => {
      const today = todayIsoDate()
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
        start_date: filters.start_date || today,
        end_date: filters.end_date || today,
      }
      if (filters.class_id) params.class_id = filters.class_id
      if (filters.section_id) params.section_id = filters.section_id
      if (filters.student_id) params.student_id = filters.student_id

      const response = await axios.get(`${API_URL}/reports/attendance`, {
        params,
        headers: scopedHeaders,
      })
      return {
        data: response.data.data,
        summary: response.data.summary,
      }
    },
    { enabled: !!user && !!academicYear && activeReport === 'attendance' && attendanceView === 'students' }
  )

  const attendanceReport = studentAttendancePayload?.data
  const studentAttendanceSummary = studentAttendancePayload?.summary

  const { data: studentsList } = useQuery(
    ['students-report', user?.school_id, academicYear?.id, branchScopeKey, filters.class_id, filters.section_id],
    async () => {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
        status: 'Active',
      }
      if (filters.class_id) params.class_id = filters.class_id
      if (filters.section_id) params.section_id = filters.section_id

      const response = await axios.get(`${API_URL}/students`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && (activeReport === 'attendance' || activeReport === 'student') && (activeReport !== 'attendance' || attendanceView === 'students') }
  )

  const { data: teachersList } = useQuery(
    ['teachers-report', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/teachers`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          active_only: 'true',
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeReport === 'attendance' }
  )

  const { data: staffAttendancePayload, isLoading: staffAttendanceLoading } = useQuery(
    ['staff-attendance-report', user?.school_id, academicYear?.id, branchScopeKey, filters],
    async () => {
      const today = todayIsoDate()
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
        start_date: filters.start_date || today,
        end_date: filters.end_date || today,
      }
      if (filters.staff_id) params.staff_id = filters.staff_id

      const response = await axios.get(`${API_URL}/reports/staff-attendance`, {
        params,
        headers: scopedHeaders,
      })
      return {
        data: response.data.data,
        summary: response.data.summary,
      }
    },
    { enabled: !!user && !!academicYear && activeReport === 'attendance' && attendanceView === 'teachers' }
  )

  const staffAttendanceReport = staffAttendancePayload?.data
  const staffAttendanceSummary = staffAttendancePayload?.summary

  const teacherFilterOptions = useMemo(
    () =>
      [...(teachersList || [])]
        .sort((a: { name: string }, b: { name: string }) =>
          String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
        )
        .map((teacher: { id: number; name: string; employee_id?: string }) => ({
          value: String(teacher.id),
          label: teacher.employee_id
            ? `${teacher.name} · ${teacher.employee_id}`
            : teacher.name,
        })),
    [teachersList]
  )

  const studentFilterOptions = useMemo(
    () =>
      [...(studentsList || [])]
        .sort((a: { first_name: string; last_name?: string }, b: { first_name: string; last_name?: string }) =>
          `${a.first_name} ${a.last_name || ''}`.localeCompare(
            `${b.first_name} ${b.last_name || ''}`,
            undefined,
            { sensitivity: 'base' }
          )
        )
        .map((student: { id: number; first_name: string; last_name?: string; roll_number?: string }) => {
          const name = `${student.first_name} ${student.last_name || ''}`.trim()
          return {
            value: String(student.id),
            label: student.roll_number ? `${name} · ${student.roll_number}` : name,
          }
        }),
    [studentsList]
  )

  const { data: academicReport, isLoading: academicLoading } = useQuery(
    ['academic-report', user?.school_id, academicYear?.id, branchScopeKey, filters],
    async () => {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
      }
      if (filters.exam_id) params.exam_id = filters.exam_id
      if (filters.class_id) params.class_id = filters.class_id
      if (filters.section_id) params.section_id = filters.section_id

      const response = await axios.get(`${API_URL}/reports/academic`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeReport === 'academic' }
  )

  // Revenue Report
  const { data: revenueReport, isLoading: revenueLoading } = useQuery(
    ['revenue-report', user?.school_id, academicYear?.id, branchScopeKey, filters],
    async () => {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
      }
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      if (filters.class_id) params.class_id = filters.class_id
      if (filters.payment_mode) params.payment_mode = filters.payment_mode
      if (filters.collection_type) params.collection_type = filters.collection_type

      const response = await axios.get(`${API_URL}/reports/revenue`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && showRevenueReports && activeReport === 'revenue' }
  )

  const revenueCollectionLabels = useMemo(
    () => getRevenueCollectionLabels(revenueReport?.collection_type || filters.collection_type),
    [revenueReport?.collection_type, filters.collection_type]
  )

  const revenuePendingTotal = useMemo(() => {
    const fromSummary = Number(revenueReport?.total?.total_pending || 0)
    if (fromSummary > 0) return fromSummary

    const txs = revenueReport?.transactions
    if (!Array.isArray(txs) || txs.length === 0) return fromSummary

    const pendingByKey = new Map<string, number>()
    for (const tx of txs) {
      const row = tx as Record<string, unknown>
      const feeStructureId = Number(row.fee_structure_id)
      const pending = Number(row.pending_amount ?? row.base_amount ?? 0)
      if (!Number.isFinite(pending) || pending <= 0) continue

      const dedupeKey =
        Number.isFinite(feeStructureId) && feeStructureId > 0
          ? `fs:${feeStructureId}`
          : `student:${String(row.student_name || '').trim().toLowerCase()}:${String(row.class_name || '').trim().toLowerCase()}`

      pendingByKey.set(dedupeKey, pending)
    }

    if (pendingByKey.size === 0) return fromSummary
    return [...pendingByKey.values()].reduce((sum, value) => sum + value, 0)
  }, [revenueReport])

  // Expense Report
  const { data: expenseReport, isLoading: expenseLoading } = useQuery(
    ['expense-report', user?.school_id, academicYear?.id, branchScopeKey, filters],
    async () => {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
      }
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      if (filters.category) params.category = filters.category

      const response = await axios.get(`${API_URL}/reports/expense`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeReport === 'expense' }
  )

  const { data: studentReport, isLoading: studentReportLoading, error: studentReportError } = useQuery(
    ['student-report', user?.school_id, academicYear?.id, branchScopeKey, filters.student_id],
    async () => {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
        student_id: filters.student_id,
      }

      const response = await axios.get(`${API_URL}/reports/student`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && activeReport === 'student' && !!filters.student_id, retry: false }
  )

  const filteredExpenseCategories = useMemo(() => {
    const rows = expenseReport?.by_category
    if (!rows?.length) return []
    const q = expenseSearchTerm.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((category: { category?: string; total_amount?: number | string; expense_count?: number }) => {
      const haystack = [
        String(category.category || ''),
        String(category.total_amount || ''),
        String(category.expense_count || ''),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [expenseReport, expenseSearchTerm])

  const handleFilterChange = (name: string, value: string) => {
    setFilters((prev: any) => ({
      ...prev,
      [name]: value,
      ...(name === 'class_id' && { section_id: '', student_id: '' }),
      ...(name === 'section_id' && { student_id: '' }),
      ...(name === 'collection_type' && value === 'pending' && { payment_mode: '' }),
    }))
  }

  const resetFilters = () => {
    const today = todayIsoDate()
    setFilters({
      start_date: activeReport === 'attendance' ? today : '',
      end_date: activeReport === 'attendance' ? today : '',
      class_id: '',
      section_id: '',
      staff_id: '',
      student_id: '',
      exam_id: '',
      category: '',
      payment_mode: '',
      collection_type: '',
    })
  }

  const hasActiveReportFilters = useMemo(
    () =>
      Object.values(filters).some((value) => Boolean(value)) ||
      (activeReport === 'expense' && !!expenseSearchTerm.trim()),
    [filters, activeReport, expenseSearchTerm]
  )

  useEffect(() => {
    if (!activeReport) return
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [activeReport])

  useClickOutside(
    [exportMenuAnchorRef, exportMenuPanelRef],
    () => setShowExportMenu(false),
    showExportMenu
  )

  const prepareExportPreview = () => {
    let previewData: any = {
      report_type: activeReport,
      filters: filters,
      record_count: 0,
    }

    if (activeReport === 'attendance' && attendanceView === 'students' && attendanceReport) {
      previewData.report_type = 'student_attendance'
      previewData.record_count = attendanceReport.length
      previewData.sample_data = attendanceReport.slice(0, 5)
    } else if (activeReport === 'attendance' && attendanceView === 'teachers' && staffAttendanceReport) {
      previewData.report_type = 'teacher_attendance'
      previewData.record_count = staffAttendanceReport.length
      previewData.sample_data = staffAttendanceReport.slice(0, 5)
    } else if (activeReport === 'academic' && academicReport) {
      previewData.record_count = academicReport.length
      previewData.sample_data = academicReport.slice(0, 5)
    } else if (showRevenueReports && activeReport === 'revenue' && revenueReport) {
      previewData.record_count = revenueReport.transactions?.length || 0
      previewData.sample_data = revenueReport.transactions?.slice(0, 5) || []
      previewData.summary = revenueReport.total
    } else if (activeReport === 'expense' && expenseReport) {
      previewData.record_count = expenseReport.by_category?.length || 0
      previewData.sample_data = expenseReport.by_category?.slice(0, 5) || []
      previewData.summary = expenseReport.total
    } else if (activeReport === 'student' && studentReport) {
      previewData.report_type = 'student_report'
      previewData.record_count = studentReport.attendance?.records?.length || 0
      previewData.sample_data = studentReport.attendance?.records?.slice(0, 5) || []
      previewData.summary = {
        profile: studentReport.profile?.full_name,
        attendance_percentage: studentReport.attendance?.summary?.attendance_percentage,
        total_pending: studentReport.fees?.summary?.total_pending,
      }
    }

    setExportPreviewData(previewData)
  }

  const showExportPreviewModal = () => {
    prepareExportPreview()
    setShowExportPreview(true)
  }

  const handleExport = async (format: string, options?: { combined?: boolean }) => {
    setIsExporting(format as 'excel' | 'pdf' | 'csv' | 'json')
    try {
      const params: any = {
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
        format: format,
      }
      const dateStamp = new Date().toISOString().split('T')[0]

      if (activeReport === 'attendance') {
        if (options?.combined) {
          if (filters.class_id) params.class_id = filters.class_id
          if (filters.section_id) params.section_id = filters.section_id
          if (filters.staff_id) params.staff_id = filters.staff_id
          if (filters.start_date) params.start_date = filters.start_date
          if (filters.end_date) params.end_date = filters.end_date

          const response = await axios.get(`${API_URL}/reports/attendance/combined-export`, {
            params: { ...params, format: 'excel' },
            headers: scopedHeaders,
            responseType: 'blob',
          })
          downloadExportBlob(
            new Blob([response.data]),
            `attendance_report_combined_${dateStamp}.xlsx`
          )
        } else if (attendanceView === 'teachers') {
          if (filters.staff_id) params.staff_id = filters.staff_id
          if (filters.start_date) params.start_date = filters.start_date
          if (filters.end_date) params.end_date = filters.end_date

          const response = await axios.get(`${API_URL}/reports/staff-attendance/export`, {
            params,
            headers: scopedHeaders,
            responseType: format === 'json' ? 'json' : 'blob',
          })

          if (format === 'json') {
            const jsonStr = JSON.stringify(response.data, null, 2)
            downloadExportBlob(
              new Blob([jsonStr], { type: 'application/json' }),
              `teacher_attendance_report_${dateStamp}.json`
            )
          } else {
            const extension = format === 'pdf' ? 'pdf' : format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'
            downloadExportBlob(
              new Blob([response.data]),
              `teacher_attendance_report_${dateStamp}.${extension}`
            )
          }
        } else {
          const today = todayIsoDate()
          if (filters.class_id) params.class_id = filters.class_id
          if (filters.section_id) params.section_id = filters.section_id
          if (filters.student_id) params.student_id = filters.student_id
          params.start_date = filters.start_date || today
          params.end_date = filters.end_date || today

          const response = await axios.get(`${API_URL}/reports/attendance/export`, {
            params,
            headers: scopedHeaders,
            responseType: format === 'json' ? 'json' : 'blob',
          })

          if (format === 'json') {
            const jsonStr = JSON.stringify(response.data, null, 2)
            downloadExportBlob(
              new Blob([jsonStr], { type: 'application/json' }),
              `student_attendance_report_${dateStamp}.json`
            )
          } else {
            const extension = format === 'pdf' ? 'pdf' : format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'
            downloadExportBlob(
              new Blob([response.data]),
              `student_attendance_report_${dateStamp}.${extension}`
            )
          }
        }
      } else if (activeReport === 'academic') {
        if (filters.exam_id) params.exam_id = filters.exam_id
        if (filters.class_id) params.class_id = filters.class_id
        if (filters.section_id) params.section_id = filters.section_id

        const response = await axios.get(`${API_URL}/reports/academic/export`, {
          params,
          headers: scopedHeaders,
          responseType: format === 'json' ? 'json' : 'blob',
        })

        if (format === 'json') {
          const jsonStr = JSON.stringify(response.data, null, 2)
          const blob = new Blob([jsonStr], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `academic_report_${new Date().toISOString().split('T')[0]}.json`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        } else {
          const extension = format === 'pdf' ? 'pdf' : format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `academic_report_${new Date().toISOString().split('T')[0]}.${extension}`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        }
      } else if (activeReport === 'revenue') {
        if (!showRevenueReports) {
          alert('You do not have permission to export revenue reports.')
          return
        }
        if (filters.start_date) params.start_date = filters.start_date
        if (filters.end_date) params.end_date = filters.end_date
        if (filters.class_id) params.class_id = filters.class_id
        if (filters.payment_mode) params.payment_mode = filters.payment_mode
        if (filters.collection_type) params.collection_type = filters.collection_type

        const response = await axios.get(`${API_URL}/reports/revenue/export`, {
          params,
          headers: scopedHeaders,
          responseType: format === 'json' ? 'json' : 'blob',
        })

        if (format === 'json') {
          const jsonStr = JSON.stringify(response.data, null, 2)
          const blob = new Blob([jsonStr], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `revenue_report_${new Date().toISOString().split('T')[0]}.json`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        } else {
          const extension = format === 'pdf' ? 'pdf' : format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `revenue_report_${new Date().toISOString().split('T')[0]}.${extension}`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        }
      } else if (activeReport === 'expense') {
        if (filters.start_date) params.start_date = filters.start_date
        if (filters.end_date) params.end_date = filters.end_date
        if (filters.category) params.category = filters.category

        const response = await axios.get(`${API_URL}/reports/expense/export`, {
          params,
          headers: scopedHeaders,
          responseType: format === 'json' ? 'json' : 'blob',
        })

        if (format === 'json') {
          const jsonStr = JSON.stringify(response.data, null, 2)
          const blob = new Blob([jsonStr], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `expense_report_${new Date().toISOString().split('T')[0]}.json`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        } else {
          const extension = format === 'pdf' ? 'pdf' : format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `expense_report_${new Date().toISOString().split('T')[0]}.${extension}`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        }
      } else if (activeReport === 'student') {
        if (!filters.student_id) {
          alert('Please select a student to export.')
          return
        }
        params.student_id = filters.student_id

        const response = await axios.get(`${API_URL}/reports/student/export`, {
          params,
          headers: scopedHeaders,
          responseType: format === 'json' ? 'json' : 'blob',
        })

        const safeName = String(studentReport?.profile?.full_name || 'student')
          .replace(/[^\w\-]+/g, '_')
          .slice(0, 40)

        if (format === 'json') {
          const jsonStr = JSON.stringify(response.data, null, 2)
          const blob = new Blob([jsonStr], { type: 'application/json' })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `student_report_${safeName}_${dateStamp}.json`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        } else {
          const extension = format === 'excel' || format === 'xlsx' ? 'xlsx' : 'csv'
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `student_report_${safeName}_${dateStamp}.${extension}`)
          document.body.appendChild(link)
          link.click()
          link.remove()
        }
      }

      setShowExportPreview(false)
      setIsExporting(null)
    } catch (error: any) {
      console.error('Export error:', error)
      alert('Failed to export report. Please try again.')
      setIsExporting(null)
    }
  }

  const handleExportFromPreview = () => {
    handleExport(selectedExportFormat)
  }

  const { data: expenseCategories } = useQuery(
    ['expense-categories', user?.school_id, 'active'],
    async () => {
      const response = await axios.get(`${API_URL}/expense-master/categories`, {
        params: { school_id: user?.school_id, active_only: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data as { id: number; name: string }[]
    },
    { enabled: !!user && !!token && !!user?.school_id }
  )

  if (activeReport) {
    return (
      <Layout>
        <div className="page-container flex flex-col page-container-viewport overflow-hidden">
          <div className="reports-detail-panel table-shell flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="shrink-0 px-3 sm:px-4 py-2.5 border-b border-white/10">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
              {activeReport === 'revenue' && (
                <div className="shrink-0 pr-3 border-r border-white/10 min-w-[7.5rem]">
                  <h2 className="text-xs sm:text-sm font-semibold text-white leading-tight">Collections</h2>
                  <p className="text-[10px] text-white/55 mt-0.5 whitespace-nowrap">
                    {hasActiveReportFilters
                      ? 'Filtered totals'
                      : `${revenueReport?.transactions?.length || 0} transactions`}
                  </p>
                </div>
              )}

              {activeReport === 'expense' && (
                <div className="shrink-0 pr-3 border-r border-white/10 min-w-[7.5rem]">
                  <h2 className="text-xs sm:text-sm font-semibold text-white leading-tight">Expense report</h2>
                  <p className="text-[10px] text-white/55 mt-0.5 whitespace-nowrap">
                    {expenseSearchTerm.trim()
                      ? `${filteredExpenseCategories.length} of ${expenseReport?.by_category?.length || 0} categories`
                      : `${expenseReport?.by_category?.length || 0} categories`}
                  </p>
                </div>
              )}

              {activeReport === 'student' && (
                <div className="shrink-0 pr-3 border-r border-white/10 min-w-[7.5rem]">
                  <h2 className="text-xs sm:text-sm font-semibold text-white leading-tight">Student report</h2>
                  <p className="text-[10px] text-white/55 mt-0.5 whitespace-nowrap">
                    {filters.student_id && studentReport?.profile?.full_name
                      ? studentReport.profile.full_name
                      : 'Select a student'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 min-w-0">
                {(activeReport === 'revenue' || activeReport === 'expense' || activeReport === 'attendance') && (
                  <>
                    <div className="w-[8.75rem] shrink-0">
                      <label htmlFor="rep-start-date" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                        From date
                      </label>
                      <input
                        id="rep-start-date"
                        type="date"
                        value={filters.start_date}
                        onChange={(e) => handleFilterChange('start_date', e.target.value)}
                        className="input-field input-field-compact py-1 text-xs w-full"
                      />
                    </div>
                    <div className="w-[8.75rem] shrink-0">
                      <label htmlFor="rep-end-date" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                        To date
                      </label>
                      <input
                        id="rep-end-date"
                        type="date"
                        value={filters.end_date}
                        onChange={(e) => handleFilterChange('end_date', e.target.value)}
                        className="input-field input-field-compact py-1 text-xs w-full"
                      />
                    </div>
                  </>
                )}

                {(activeReport === 'attendance' && attendanceView === 'students') ||
                activeReport === 'academic' ||
                activeReport === 'revenue' ||
                activeReport === 'student' ? (
                  <div className="w-[9rem] shrink-0 reports-filter-dropdown">
                    <label htmlFor="rep-class" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                      Class
                    </label>
                    <SelectField
                      id="rep-class"
                      value={filters.class_id}
                      onChange={(e) => handleFilterChange('class_id', e.target.value)}
                      className="select-field py-1 text-xs w-full"
                    >
                      <option value="">All classes</option>
                      {sortedClasses.map((cls: { id: number; name: string }) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                ) : null}

                {((activeReport === 'attendance' && attendanceView === 'students') || activeReport === 'academic' || activeReport === 'student') && (
                  <div className="w-[9.25rem] shrink-0 reports-filter-dropdown">
                    <label htmlFor="rep-section" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                      Section
                    </label>
                    <SelectField
                      id="rep-section"
                      value={filters.section_id}
                      onChange={(e) => handleFilterChange('section_id', e.target.value)}
                      disabled={!filters.class_id}
                      className="select-field py-1 text-xs w-full disabled:opacity-50"
                    >
                      <option value="">All sections</option>
                      {sections?.map((sec: { id: number; name: string }) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}

                {(activeReport === 'attendance' && attendanceView === 'students' || activeReport === 'student') && (
                  <div className="w-[11rem] sm:w-[12.5rem] shrink-0 reports-filter-dropdown">
                    <label htmlFor="rep-student" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                      Student
                    </label>
                    <SingleSelectDropdown
                      id="rep-student"
                      value={filters.student_id}
                      onChange={(value) => handleFilterChange('student_id', value)}
                      options={studentFilterOptions}
                      placeholder={
                        activeReport === 'student'
                          ? filters.class_id
                            ? 'Select student'
                            : 'Select class first'
                          : 'All students'
                      }
                      searchable
                      compact
                      showCheckboxes={false}
                      disabled={activeReport === 'student' && !filters.class_id}
                      aria-label="Filter by student"
                      className="w-full"
                    />
                  </div>
                )}

                {activeReport === 'attendance' && attendanceView === 'teachers' && (
                  <div className="w-[11rem] sm:w-[12.5rem] shrink-0 reports-filter-dropdown">
                    <label htmlFor="rep-teacher" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                      Teacher
                    </label>
                    <SingleSelectDropdown
                      id="rep-teacher"
                      value={filters.staff_id}
                      onChange={(value) => handleFilterChange('staff_id', value)}
                      options={teacherFilterOptions}
                      placeholder="All teachers"
                      searchable
                      compact
                      showCheckboxes={false}
                      aria-label="Filter by teacher"
                      className="w-full"
                    />
                  </div>
                )}

                {activeReport === 'academic' && (
                  <div className="flex-1 min-w-0 max-w-[110px]">
                    <label htmlFor="rep-exam" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 truncate">
                      Exam
                    </label>
                    <SelectField
                      id="rep-exam"
                      value={filters.exam_id}
                      onChange={(e) => handleFilterChange('exam_id', e.target.value)}
                      className="select-field py-1 text-xs w-full min-w-0"
                    >
                      <option value="">All exams</option>
                      {exams?.map((exam: { id: number; name: string }) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}

                {activeReport === 'revenue' && (
                  <>
                    <div className="flex-1 min-w-0 max-w-[118px]">
                      <label htmlFor="rep-collection-type" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 truncate">
                        Type
                      </label>
                      <SelectField
                        id="rep-collection-type"
                        value={filters.collection_type}
                        onChange={(e) => handleFilterChange('collection_type', e.target.value)}
                        className="select-field py-1 text-xs w-full min-w-0"
                      >
                        {REVENUE_COLLECTION_TYPES.map((option) => (
                          <option key={option.value || 'all'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div className="flex-1 min-w-0 max-w-[110px]">
                      <label htmlFor="rep-mode" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 truncate">
                        Mode
                      </label>
                      <SelectField
                        id="rep-mode"
                        value={filters.payment_mode}
                        onChange={(e) => handleFilterChange('payment_mode', e.target.value)}
                        disabled={filters.collection_type === 'pending'}
                        className="select-field py-1 text-xs w-full min-w-0 disabled:opacity-50"
                        title={filters.collection_type === 'pending' ? 'Mode applies to collected payments only' : undefined}
                      >
                        <option value="">All modes</option>
                        {REVENUE_PAYMENT_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </>
                )}

                {activeReport === 'expense' && (
                  <div className="w-[11rem] shrink-0 reports-filter-dropdown">
                    <label htmlFor="rep-category" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                      Category
                    </label>
                    <SelectField
                      id="rep-category"
                      value={filters.category}
                      onChange={(e) => handleFilterChange('category', e.target.value)}
                      className="select-field py-1 text-xs w-full"
                    >
                      <option value="">All categories</option>
                      {expenseCategories?.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                )}
              </div>

              {activeReport === 'expense' && (
                <div className="flex-1 min-w-[11rem] basis-[11rem]">
                  <label htmlFor="rep-expense-search" className="block text-[10px] font-medium text-white/60 uppercase tracking-wide mb-0.5 whitespace-nowrap">
                    Search
                  </label>
                  <div className="relative">
                    <input
                      id="rep-expense-search"
                      type="search"
                      value={expenseSearchTerm}
                      onChange={(e) => setExpenseSearchTerm(e.target.value)}
                      placeholder="Category, amount, count…"
                      className="input-field input-field-compact py-1 text-xs w-full pl-8"
                    />
                    <svg
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/45 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>
              )}

              <div className="shrink-0 flex items-center gap-1.5 ml-auto pl-2 border-l border-white/10">
                {hasActiveReportFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      resetFilters()
                      setExpenseSearchTerm('')
                    }}
                    className="px-2 py-1 text-[10px] font-medium text-white/70 hover:text-white whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
                <ExportMenu
                  onExport={(format) => handleExport(format)}
                  isExporting={isExporting === 'excel' || isExporting === 'pdf' ? isExporting : null}
                  disabled={!!isExporting}
                  size="sm"
                />
                <div className="relative" ref={exportMenuAnchorRef}>
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((open) => !open)}
                    disabled={isExporting}
                    className="btn-secondary px-2 py-1 text-[10px] whitespace-nowrap disabled:opacity-50"
                  >
                    More
                  </button>
                  <DropdownPanelPortal
                    open={showExportMenu}
                    anchorRef={exportMenuAnchorRef}
                    panelRef={exportMenuPanelRef}
                    align="end"
                    className="w-36 py-1"
                    style={{ minWidth: '9rem' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false)
                        handleExport('csv')
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-white/90 hover:bg-white/10"
                    >
                      CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false)
                        handleExport('json')
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-white/90 hover:bg-white/10"
                    >
                      JSON
                    </button>
                    {activeReport === 'attendance' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false)
                          handleExport('excel', { combined: true })
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-white/90 hover:bg-white/10 border-t border-white/10"
                      >
                        Combined Excel
                      </button>
                    )}
                  </DropdownPanelPortal>
                </div>
              </div>
              </div>
            </div>

            <div className="reports-detail-body flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Attendance Report */}
          {activeReport === 'attendance' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="shrink-0 px-4 py-2 border-b border-white/10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = todayIsoDate()
                    setAttendanceView('students')
                    setFilters((prev: any) => ({
                      ...prev,
                      start_date: prev.start_date || today,
                      end_date: prev.end_date || today,
                    }))
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    attendanceView === 'students'
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Students
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = todayIsoDate()
                    setAttendanceView('teachers')
                    setFilters((prev: any) => ({
                      ...prev,
                      start_date: prev.start_date || today,
                      end_date: prev.end_date || today,
                    }))
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    attendanceView === 'teachers'
                      ? 'bg-white/15 text-white border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Teachers
                </button>
              </div>

              {attendanceView === 'students' ? (
                attendanceLoading ? (
                  <div className="flex flex-1 items-center justify-center py-12 text-slate-500">Loading student attendance…</div>
                ) : attendanceReport && attendanceReport.length > 0 ? (
                  <>
                    <div className="shrink-0 px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-white">
                        Total Records: {attendanceReport.length}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-white/70">
                        <span>
                          Present:{' '}
                          <strong className="text-emerald-200 font-semibold">
                            {studentAttendanceSummary?.present_count ?? 0}
                          </strong>
                        </span>
                        <span>
                          Absent:{' '}
                          <strong className="text-red-300 font-semibold">
                            {studentAttendanceSummary?.absent_count ?? 0}
                          </strong>
                        </span>
                        <span>
                          Late:{' '}
                          <strong className="text-amber-200 font-semibold">
                            {studentAttendanceSummary?.late_count ?? 0}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <div className="reports-detail-scroll reports-detail-scroll--fit flex-1 min-h-0">
                    <table className="data-table reports-revenue-table reports-attendance-table reports-attendance-table--students w-full">
                      <colgroup>
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '31%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Roll</th>
                          <th>Student</th>
                          <th>Adm No</th>
                          <th>Class</th>
                          <th>Sec</th>
                          <th>Status</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceReport.map((record: any) => (
                          <tr key={record.id}>
                            <td className="cell-nowrap">
                              {formatReportDateDisplay(record.attendance_date)}
                            </td>
                            <td className="cell-nowrap font-mono text-[10px] text-white/80">
                              {record.roll_number || '—'}
                            </td>
                            <td className="cell-nowrap">
                              <span className="font-medium text-white block truncate" title={`${record.first_name} ${record.last_name || ''}`}>
                                {record.first_name} {record.last_name || ''}
                              </span>
                            </td>
                            <td className="cell-nowrap font-mono text-[10px] text-white/70">
                              {record.admission_number || '—'}
                            </td>
                            <td className="cell-nowrap">{record.class_name || '—'}</td>
                            <td className="cell-nowrap">{record.section_name || '—'}</td>
                            <td>
                              <span
                                className={`status-pill ${
                                  record.status === 'Present'
                                    ? 'bg-emerald-500/20 text-emerald-200'
                                    : record.status === 'Absent'
                                    ? 'bg-red-500/20 text-red-200'
                                    : record.status === 'Late'
                                    ? 'bg-amber-500/20 text-amber-200'
                                    : record.status === 'Excused'
                                    ? 'bg-violet-500/20 text-violet-200'
                                    : 'bg-white/10 text-white/70'
                                }`}
                              >
                                {record.status || '—'}
                              </span>
                            </td>
                            <td className="cell-remarks">{record.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={6} className="text-right text-white/80 text-[11px]">
                            Totals
                          </td>
                          <td className="text-emerald-200 text-[11px]">
                            P:{studentAttendanceSummary?.present_count ?? 0}{' '}
                            <span className="text-red-300">A:{studentAttendanceSummary?.absent_count ?? 0}</span>{' '}
                            <span className="text-amber-200">L:{studentAttendanceSummary?.late_count ?? 0}</span>
                          </td>
                          <td className="text-white/70 text-[11px]">{attendanceReport.length}</td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center py-12 text-slate-500">No student attendance data found for the selected dates</div>
                )
              ) : staffAttendanceLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 text-slate-500">Loading teacher attendance…</div>
              ) : staffAttendanceReport && staffAttendanceReport.length > 0 ? (
                <>
                  <div className="shrink-0 px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white">
                      Total Records: {staffAttendanceReport.length}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
                      <span>
                        Total Work Hours:{' '}
                        <strong className="text-white font-semibold">
                          {staffAttendanceSummary?.total_work_hours ||
                            formatStaffWorkHours(
                              staffAttendanceReport.reduce(
                                (sum: number, r: any) => sum + (Number(r.total_work_minutes) || 0),
                                0
                              )
                            )}
                        </strong>
                      </span>
                      {(staffAttendanceSummary?.total_sessions ?? 0) > 0 && (
                        <span>
                          Sessions:{' '}
                          <strong className="text-white font-semibold">
                            {staffAttendanceSummary?.total_sessions}
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="reports-detail-scroll reports-detail-scroll--fit flex-1 min-h-0">
                  <table className="data-table reports-revenue-table reports-attendance-table reports-attendance-table--teachers w-full">
                    <colgroup>
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '28%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Emp ID</th>
                        <th>Teacher</th>
                        <th>Status</th>
                        <th>Login</th>
                        <th>Logout</th>
                        <th>Hours</th>
                        <th>Sess</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffAttendanceReport.map((record: any) => (
                        <tr key={record.id}>
                          <td className="cell-nowrap">
                            {formatReportDateDisplay(record.attendance_date)}
                          </td>
                          <td className="cell-nowrap font-mono text-[10px] text-white/80" title={record.employee_id || ''}>
                            {record.employee_id || '—'}
                          </td>
                          <td className="cell-nowrap">
                            <span className="font-medium text-white block truncate" title={record.staff_name}>
                              {record.staff_name}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                record.status === 'Present'
                                  ? 'bg-emerald-500/20 text-emerald-200'
                                  : record.status === 'Absent'
                                  ? 'bg-red-500/20 text-red-200'
                                  : record.status === 'Late'
                                  ? 'bg-amber-500/20 text-amber-200'
                                  : 'bg-white/10 text-white/70'
                              }`}
                            >
                              {record.status || '—'}
                            </span>
                          </td>
                          <td className="cell-nowrap tabular-nums text-emerald-100">
                            {formatReportTimeDisplay(record.check_in_time)}
                          </td>
                          <td className="cell-nowrap tabular-nums text-sky-100">
                            {formatReportTimeDisplay(record.check_out_time)}
                          </td>
                          <td className="cell-nowrap tabular-nums font-medium text-white">
                            {formatStaffWorkHours(record.total_work_minutes)}
                          </td>
                          <td className="cell-nowrap tabular-nums text-center text-white/70">
                            {(record.work_session_count ?? 0) > 0 ? record.work_session_count : '—'}
                          </td>
                          <td className="cell-remarks">{record.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} className="text-right text-white/80 text-[11px]">
                          Total hours
                        </td>
                        <td className="cell-nowrap tabular-nums text-emerald-200 text-[11px]">
                          {staffAttendanceSummary?.total_work_hours ||
                            formatStaffWorkHours(
                              staffAttendanceReport.reduce(
                                (sum: number, r: any) => sum + (Number(r.total_work_minutes) || 0),
                                0
                              )
                            )}
                        </td>
                        <td className="cell-nowrap tabular-nums text-center text-white text-[11px]">
                          {staffAttendanceSummary?.total_sessions ?? '—'}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center py-12 text-slate-500">No teacher attendance data found for the selected dates</div>
              )}
            </div>
          )}

          {/* Academic Report */}
          {activeReport === 'academic' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {academicLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 text-slate-500">Loading academic report…</div>
              ) : academicReport && academicReport.length > 0 ? (
                <>
                  <div className="shrink-0 px-4 py-2.5 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white">
                      Total Records: {academicReport.length}
                    </h3>
                  </div>
                  <div className="reports-detail-scroll flex-1 min-h-0 overflow-auto">
                  <table className="data-table reports-revenue-table min-w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Roll No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Exam</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Marks</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {academicReport.map((record: any, index: number) => {
                        const percentage = (record.marks_obtained / record.max_marks) * 100
                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-6 py-4 text-sm text-slate-900">{record.roll_number}</td>
                            <td className="px-6 py-4 text-sm text-slate-900">
                              {record.first_name} {record.last_name}
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-900">{record.exam_name}</td>
                            <td className="px-6 py-4 text-sm text-slate-900">{record.subject_name}</td>
                            <td className="px-6 py-4 text-sm text-slate-900">
                              {record.marks_obtained} / {record.max_marks} ({percentage.toFixed(1)}%)
                            </td>
                            <td className="px-6 py-4 text-sm font-medium">
                              <span
                                className={`${
                                  percentage >= 80
                                    ? 'text-green-300'
                                    : percentage >= 60
                                    ? 'text-yellow-300'
                                    : 'text-red-600'
                                }`}
                              >
                                {record.grade || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center py-12 text-slate-500">No academic data found</div>
              )}
            </div>
          )}

          {/* Revenue Report */}
          {showRevenueReports && activeReport === 'revenue' && (
            <>
              {revenueLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">Loading revenue report…</div>
              ) : revenueReport ? (
                <>
                  <div className="shrink-0 glass-card-opaque p-0 overflow-hidden border-b border-white/10">
                    <div className="flex flex-wrap divide-x divide-white/10">
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-emerald-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">{revenueCollectionLabels.total}</p>
                        <p className="text-base sm:text-lg font-bold text-emerald-100 tabular-nums mt-0.5">
                          {formatMoney(revenueReport.total?.total_collected)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-blue-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Pending Amount</p>
                        <p className="text-base sm:text-lg font-bold text-blue-100 tabular-nums mt-0.5">
                          {formatMoney(revenuePendingTotal)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-amber-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Fines</p>
                        <p className="text-base sm:text-lg font-bold text-amber-100 tabular-nums mt-0.5">
                          {formatMoney(revenueReport.total?.total_fine)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-violet-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Discounts</p>
                        <p className="text-base sm:text-lg font-bold text-violet-100 tabular-nums mt-0.5">
                          {formatMoney(revenueReport.total?.total_discount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="reports-detail-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                    {revenueReport.transactions && revenueReport.transactions.length > 0 ? (
                      <table className="data-table reports-revenue-table w-full">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Receipt</th>
                            <th>Student</th>
                            <th>Class</th>
                            <th>Pending</th>
                            <th>Fines</th>
                            <th>Discount</th>
                            <th>{revenueCollectionLabels.column}</th>
                            <th>Mode</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revenueReport.transactions.map((tx: Record<string, unknown>, index: number) => {
                            const rowKey = tx.id != null ? String(tx.id) : `tx-${index}`
                            const studentName = String(tx.student_name || '—').trim() || '—'
                            return (
                              <tr key={rowKey}>
                                <td className="whitespace-nowrap">
                                  {formatReportTxDate(tx.transaction_date)}
                                </td>
                                <td className="font-mono text-xs whitespace-nowrap">
                                  {tx.receipt_number ? String(tx.receipt_number) : '—'}
                                </td>
                                <td>
                                  <p className="font-medium text-white max-w-[160px] truncate" title={studentName}>
                                    {studentName}
                                  </p>
                                  {tx.admission_number ? (
                                    <p className="text-xs text-white/50 mt-0.5 font-mono truncate">
                                      {String(tx.admission_number)}
                                    </p>
                                  ) : null}
                                </td>
                                <td>
                                  <span className="block max-w-[90px] truncate" title={String(tx.class_name || '')}>
                                    {tx.class_name ? String(tx.class_name) : '—'}
                                  </span>
                                </td>
                                <td className="tabular-nums text-blue-100 whitespace-nowrap font-medium">
                                  {formatMoney((tx.pending_amount ?? tx.base_amount) as number)}
                                </td>
                                <td className="tabular-nums text-amber-100 whitespace-nowrap">
                                  {formatMoney(tx.fine_amount as number)}
                                </td>
                                <td className="tabular-nums text-violet-100 whitespace-nowrap">
                                  {formatMoney(tx.discount_amount as number)}
                                </td>
                                <td className="tabular-nums font-bold text-emerald-100 whitespace-nowrap">
                                  {formatMoney(tx.total_collected as number)}
                                </td>
                                <td className="whitespace-nowrap">
                                  {formatReportPaymentMode(tx.payment_mode as string)}
                                </td>
                                <td>
                                  <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full text-white/80 border border-white/20 bg-white/10 uppercase">
                                    {String(tx.status || '—')}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-14 meta-text">No transactions match the selected filters.</div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">No revenue data found</div>
              )}
            </>
          )}

          {/* Expense Report */}
          {activeReport === 'expense' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {expenseLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">Loading expense report…</div>
              ) : expenseReport ? (
                <>
                  <div className="shrink-0 glass-card-opaque p-0 overflow-hidden border-b border-white/10">
                    <div className="flex divide-x divide-white/10">
                      <div className="flex-1 min-w-0 px-3 py-2.5 border-l-2 border-red-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Total expenses</p>
                        <p className="text-base sm:text-lg font-bold text-red-100 tabular-nums mt-0.5">
                          {formatMoney(expenseReport.total?.total_amount)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0 px-3 py-2.5 border-l-2 border-blue-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Total transactions</p>
                        <p className="text-base sm:text-lg font-bold text-blue-100 tabular-nums mt-0.5">
                          {expenseReport.total?.expense_count || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {expenseReport.by_category && expenseReport.by_category.length > 0 ? (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                      <div className="shrink-0 px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-white">Expenses by category</h3>
                        {expenseSearchTerm.trim() ? (
                          <span className="text-xs text-white/55">
                            Showing {filteredExpenseCategories.length} of {expenseReport.by_category.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="reports-detail-scroll flex-1 min-h-0 overflow-auto">
                        {filteredExpenseCategories.length === 0 ? (
                          <div className="flex items-center justify-center py-14 text-white/55 text-sm">
                            No categories match your search.
                          </div>
                        ) : (
                          <table className="data-table reports-revenue-table w-full">
                            <thead>
                              <tr>
                                <th>Category</th>
                                <th className="text-right">Total amount</th>
                                <th className="text-right">Transactions</th>
                                <th className="text-right">Percentage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredExpenseCategories.map((category: { category?: string; total_amount?: number | string; expense_count?: number }, index: number) => {
                                const total = parseFloat(String(expenseReport.total?.total_amount || 1))
                                const percentage = ((parseFloat(String(category.total_amount || 0)) / total) * 100).toFixed(1)
                                const categoryName = String(category.category || '—')
                                return (
                                  <tr key={`${categoryName}-${index}`}>
                                    <td>
                                      <p className="font-medium text-white max-w-[280px] truncate" title={categoryName}>
                                        {categoryName}
                                      </p>
                                    </td>
                                    <td className="text-right whitespace-nowrap">
                                      <span className="font-bold tabular-nums text-red-200">
                                        {formatMoney(category.total_amount)}
                                      </span>
                                    </td>
                                    <td className="text-right tabular-nums text-white/90">
                                      {category.expense_count ?? 0}
                                    </td>
                                    <td className="text-right tabular-nums text-white/80">
                                      {percentage}%
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center py-12 meta-text">No expense categories found</div>
                  )}
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">No expense data found</div>
              )}
            </div>
          )}

          {/* Student Report */}
          {activeReport === 'student' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {!filters.class_id ? (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">
                  Select a class and section, then choose a student to view the complete report.
                </div>
              ) : !filters.student_id ? (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">
                  Select a student to generate the comprehensive report.
                </div>
              ) : studentReportLoading ? (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">Loading student report…</div>
              ) : studentReportError ? (
                <div className="flex flex-1 items-center justify-center py-12 px-4">
                  <p className="text-sm text-red-200 text-center">
                    {(studentReportError as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                      'Could not load student report.'}
                  </p>
                </div>
              ) : studentReport ? (
                <div className="reports-detail-scroll flex-1 min-h-0 overflow-y-auto">
                  <div className="shrink-0 glass-card-opaque p-0 overflow-hidden border-b border-white/10">
                    <div className="flex flex-wrap divide-x divide-white/10">
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-emerald-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Attendance</p>
                        <p className="text-base sm:text-lg font-bold text-emerald-100 tabular-nums mt-0.5">
                          {studentReport.attendance?.summary?.attendance_percentage ?? 0}%
                        </p>
                      </div>
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-red-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Fee pending</p>
                        <p className="text-base sm:text-lg font-bold text-red-100 tabular-nums mt-0.5">
                          {formatMoney(studentReport.fees?.summary?.total_pending)}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-blue-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Payments made</p>
                        <p className="text-base sm:text-lg font-bold text-blue-100 tabular-nums mt-0.5">
                          {studentReport.fees?.summary?.payment_count ?? 0}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[120px] px-3 py-2.5 border-l-2 border-amber-400/50">
                        <p className="text-[10px] font-semibold text-white/65 uppercase tracking-wide">Joined</p>
                        <p className="text-base sm:text-lg font-bold text-amber-100 tabular-nums mt-0.5">
                          {studentReport.profile?.joining_year || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-b border-white/10">
                    <div className="glass-card p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 mb-5 border-b border-white/10">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white truncate">
                            {studentReport.profile?.full_name || 'Student'}
                          </h3>
                          <p className="text-sm text-white/60 mt-0.5">
                            {[
                              studentReport.profile?.class_name,
                              studentReport.profile?.section_name,
                              studentReport.profile?.roll_number
                                ? `Roll ${studentReport.profile.roll_number}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm shrink-0">
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-white/50">Admission no</p>
                            <p className="text-white font-medium">{studentReport.profile?.admission_number || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-white/50">Status</p>
                            <p className="text-white font-medium">{studentReport.profile?.status || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-white/50">Academic year</p>
                            <p className="text-white font-medium">{studentReport.profile?.academic_year_name || '—'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <h4 className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-3">
                            Personal details
                          </h4>
                          <dl className="student-report-detail-grid">
                            <div>
                              <dt>Gender</dt>
                              <dd>{studentReport.profile?.gender || '—'}</dd>
                            </div>
                            <div>
                              <dt>Date of birth</dt>
                              <dd>{formatReportDateDisplay(studentReport.profile?.date_of_birth)}</dd>
                            </div>
                            <div>
                              <dt>Phone</dt>
                              <dd>{studentReport.profile?.phone || studentReport.profile?.father_phone || '—'}</dd>
                            </div>
                            <div>
                              <dt>Email</dt>
                              <dd className="truncate" title={studentReport.profile?.email || undefined}>
                                {studentReport.profile?.email || '—'}
                              </dd>
                            </div>
                            <div className="student-report-detail-grid-span-2">
                              <dt>Address</dt>
                              <dd>
                                {[studentReport.profile?.address, studentReport.profile?.city, studentReport.profile?.state, studentReport.profile?.pincode]
                                  .filter(Boolean)
                                  .join(', ') || '—'}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h4 className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-3">
                            Parents & enrollment
                          </h4>
                          <dl className="student-report-detail-grid">
                            <div>
                              <dt>Father</dt>
                              <dd>{studentReport.profile?.father_name || '—'}</dd>
                            </div>
                            <div>
                              <dt>Mother</dt>
                              <dd>{studentReport.profile?.mother_name || '—'}</dd>
                            </div>
                            <div>
                              <dt>Guardian</dt>
                              <dd>{studentReport.profile?.guardian_name || '—'}</dd>
                            </div>
                            <div>
                              <dt>Guardian phone</dt>
                              <dd>{studentReport.profile?.guardian_phone || '—'}</dd>
                            </div>
                            <div>
                              <dt>First admission</dt>
                              <dd>{formatReportDateDisplay(studentReport.profile?.first_admission_date)}</dd>
                            </div>
                            <div>
                              <dt>Joining year</dt>
                              <dd>{studentReport.profile?.joining_year || '—'}</dd>
                            </div>
                            <div>
                              <dt>Academic years enrolled</dt>
                              <dd>{studentReport.profile?.academic_years_enrolled ?? 0}</dd>
                            </div>
                          </dl>
                        </div>

                        <div>
                          <h4 className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-3">
                            Transport / van
                          </h4>
                          {studentReport.transport ? (
                            <dl className="student-report-detail-grid">
                              <div>
                                <dt>Route</dt>
                                <dd>{studentReport.transport.route_name || '—'}</dd>
                              </div>
                              <div>
                                <dt>Route code</dt>
                                <dd>{studentReport.transport.route_code || '—'}</dd>
                              </div>
                              <div>
                                <dt>Stop</dt>
                                <dd>{studentReport.transport.stop_name || '—'}</dd>
                              </div>
                              <div>
                                <dt>Van / vehicle</dt>
                                <dd>{studentReport.transport.vehicle_number || '—'}</dd>
                              </div>
                              <div>
                                <dt>Vehicle model</dt>
                                <dd>{studentReport.transport.make_model || '—'}</dd>
                              </div>
                              <div>
                                <dt>Capacity</dt>
                                <dd>{studentReport.transport.capacity || '—'}</dd>
                              </div>
                              <div className="student-report-detail-grid-span-2">
                                <dt>Route path</dt>
                                <dd>
                                  {[studentReport.transport.start_point, studentReport.transport.end_point]
                                    .filter(Boolean)
                                    .join(' → ') || '—'}
                                </dd>
                              </div>
                            </dl>
                          ) : (
                            <p className="text-sm text-white/55">No active transport assignment for this student.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-b border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-white">Attendance — monthly day-wise breakup</h3>
                      <p className="text-xs text-white/55">
                        {studentReport.attendance?.academic_year
                          ? `Academic year: ${studentReport.attendance.academic_year}`
                          : 'Full academic year attendance'}
                      </p>
                    </div>
                    {studentReport.attendance?.monthly_breakup?.length ? (
                      <div className="space-y-3">
                        {studentReport.attendance.monthly_breakup.map((month: {
                          month: string
                          attendance_percentage: number
                          present_count: number
                          absent_count: number
                          late_count: number
                          total_records: number
                          days: Array<{ date: string; status: string; remarks?: string | null }>
                        }) => (
                          <div key={month.month} className="glass-card p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <p className="text-sm font-semibold text-white">{formatReportMonthLabel(month.month)}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-white/70">
                                <span>{month.attendance_percentage}% present</span>
                                <span className="text-emerald-200">P {month.present_count}</span>
                                <span className="text-red-300">A {month.absent_count}</span>
                                <span className="text-amber-200">L {month.late_count}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {month.days.map((day) => (
                                <div
                                  key={day.date}
                                  title={`${formatReportDateDisplay(day.date)} — ${day.status}${day.remarks ? ` (${day.remarks})` : ''}`}
                                  className="min-w-[3.25rem] rounded-md border border-white/10 bg-black/20 px-1.5 py-1 text-center"
                                >
                                  <p className="text-[10px] text-white/55">{day.date.slice(8, 10)}</p>
                                  <p className={`text-[10px] font-semibold truncate ${attendanceStatusClass(day.status)}`}>
                                    {String(day.status || '—').slice(0, 3)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/55">No attendance records for this academic year.</p>
                    )}
                  </div>

                  <div className="p-4 border-b border-white/10">
                    <h3 className="text-sm font-semibold text-white mb-3">Exam results</h3>
                    {studentReport.academics?.published_results?.length ? (
                      <div className="overflow-x-auto mb-4">
                        <table className="data-table reports-revenue-table w-full min-w-[32rem]">
                          <thead>
                            <tr>
                              <th>Exam</th>
                              <th className="text-right">Obtained</th>
                              <th className="text-right">Total</th>
                              <th className="text-right">Percentage</th>
                              <th className="text-right">GPA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentReport.academics.published_results.map((result: {
                              exam_id: number
                              exam_name: string
                              obtained_marks: number
                              total_marks: number
                              percentage: number
                              gpa: number
                            }) => (
                              <tr key={`result-${result.exam_id}`}>
                                <td className="font-medium text-white">{result.exam_name}</td>
                                <td className="text-right tabular-nums">{result.obtained_marks}</td>
                                <td className="text-right tabular-nums">{result.total_marks}</td>
                                <td className="text-right tabular-nums">{Number(result.percentage || 0).toFixed(1)}%</td>
                                <td className="text-right tabular-nums">{result.gpa ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {studentReport.academics?.marks?.length ? (
                      <div className="overflow-x-auto">
                        <table className="data-table reports-revenue-table w-full min-w-[40rem]">
                          <thead>
                            <tr>
                              <th>Exam</th>
                              <th>Subject</th>
                              <th className="text-right">Marks</th>
                              <th>Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentReport.academics.marks.map((mark: {
                              exam_id: number
                              exam_name: string
                              subject_name: string
                              marks_obtained: number
                              max_marks: number
                              grade?: string
                            }, index: number) => (
                              <tr key={`mark-${mark.exam_id}-${mark.subject_name}-${index}`}>
                                <td>{mark.exam_name}</td>
                                <td className="font-medium text-white">{mark.subject_name}</td>
                                <td className="text-right tabular-nums">
                                  {mark.marks_obtained}/{mark.max_marks}
                                </td>
                                <td>{mark.grade || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-white/55">No exam marks recorded for this student.</p>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Fees & payments</h3>
                    {studentReport.fees?.structures?.length ? (
                      <div className="overflow-x-auto mb-4">
                        <table className="data-table reports-revenue-table reports-student-fees-table w-full">
                          <colgroup>
                            <col className="student-fee-col-name" />
                            <col className="student-fee-col-amount" />
                            <col className="student-fee-col-amount" />
                            <col className="student-fee-col-amount" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Fee structure</th>
                              <th className="text-right">Total</th>
                              <th className="text-right">Paid</th>
                              <th className="text-right">Pending</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentReport.fees.structures.map((fee: {
                              id: number
                              name: string
                              total_amount: number
                              paid_amount: number
                              pending_amount: number
                            }) => (
                              <tr key={fee.id}>
                                <td>
                                  <p className="font-medium text-white truncate" title={fee.name}>
                                    {fee.name}
                                  </p>
                                </td>
                                <td className="text-right tabular-nums whitespace-nowrap">{formatMoney(fee.total_amount)}</td>
                                <td className="text-right tabular-nums whitespace-nowrap text-emerald-200">{formatMoney(fee.paid_amount)}</td>
                                <td className="text-right tabular-nums whitespace-nowrap text-red-200">{formatMoney(fee.pending_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-white/55 mb-4">No fee structures assigned to this student.</p>
                    )}

                    {studentReport.fees?.payments?.length ? (
                      <div className="overflow-x-auto">
                        <table className="data-table reports-revenue-table reports-student-fees-table w-full">
                          <colgroup>
                            <col className="student-pay-col-date" />
                            <col className="student-pay-col-receipt" />
                            <col className="student-pay-col-fee" />
                            <col className="student-pay-col-mode" />
                            <col className="student-pay-col-status" />
                            <col className="student-pay-col-amount" />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Receipt</th>
                              <th>Fee</th>
                              <th>Mode</th>
                              <th>Status</th>
                              <th className="text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentReport.fees.payments.map((payment: {
                              id: number
                              payment_date: string
                              receipt_number?: string
                              fee_structure_name?: string
                              payment_mode?: string
                              status?: string
                              amount: number
                            }) => (
                              <tr key={payment.id}>
                                <td className="whitespace-nowrap">{formatReportDateDisplay(payment.payment_date)}</td>
                                <td className="font-mono text-xs">{payment.receipt_number || '—'}</td>
                                <td>{payment.fee_structure_name || '—'}</td>
                                <td>{payment.payment_mode || '—'}</td>
                                <td>{payment.status || '—'}</td>
                                <td className="text-right tabular-nums font-semibold text-emerald-200">
                                  {formatMoney(payment.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-white/55">No payment history found.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center py-12 meta-text">No student report data found</div>
              )}
            </div>
          )}

            </div>
          </div>
        </div>

          {/* Export Preview Modal */}
          {showExportPreview && exportPreviewData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
              <div className="glass-card p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="page-title">Export Preview</h2>
                  <button
                    onClick={() => setShowExportPreview(false)}
                    className="text-slate-500 hover:text-slate-900"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                    <h3 className="font-semibold text-slate-900 mb-2">Export Details</h3>
                    <div className="space-y-1 text-sm text-slate-600">
                      <p><strong>Report Type:</strong> {
                        exportPreviewData.report_type === 'teacher_attendance'
                          ? 'Teacher Attendance'
                          : exportPreviewData.report_type === 'student_attendance'
                          ? 'Student Attendance'
                          : `${exportPreviewData.report_type?.charAt(0).toUpperCase()}${exportPreviewData.report_type?.slice(1)}`
                      }</p>
                      <p><strong>Format:</strong> {selectedExportFormat.toUpperCase()}</p>
                      <p><strong>Total Records:</strong> {exportPreviewData.record_count}</p>
                      {exportPreviewData.filters && Object.keys(exportPreviewData.filters).some(k => exportPreviewData.filters[k]) && (
                        <div className="mt-2">
                          <p><strong>Applied Filters:</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            {exportPreviewData.filters.start_date && (
                              <li>Start Date: {exportPreviewData.filters.start_date}</li>
                            )}
                            {exportPreviewData.filters.end_date && (
                              <li>End Date: {exportPreviewData.filters.end_date}</li>
                            )}
                            {exportPreviewData.filters.class_id && (
                              <li>Class: {classes?.find((c: any) => c.id === parseInt(exportPreviewData.filters.class_id))?.name}</li>
                            )}
                            {exportPreviewData.filters.section_id && (
                              <li>Section: {sections?.find((s: any) => s.id === parseInt(exportPreviewData.filters.section_id))?.name}</li>
                            )}
                            {exportPreviewData.filters.staff_id && (
                              <li>
                                Teacher:{' '}
                                {teachersList?.find((t: any) => t.id === parseInt(exportPreviewData.filters.staff_id))?.name ||
                                  exportPreviewData.filters.staff_id}
                              </li>
                            )}
                            {exportPreviewData.filters.student_id && (
                              <li>
                                Student:{' '}
                                {studentsList?.find((s: any) => s.id === parseInt(exportPreviewData.filters.student_id))
                                  ? `${studentsList.find((s: any) => s.id === parseInt(exportPreviewData.filters.student_id)).first_name} ${studentsList.find((s: any) => s.id === parseInt(exportPreviewData.filters.student_id)).last_name || ''}`.trim()
                                  : exportPreviewData.filters.student_id}
                              </li>
                            )}
                            {exportPreviewData.filters.exam_id && (
                              <li>Exam: {exams?.find((e: any) => e.id === parseInt(exportPreviewData.filters.exam_id))?.name}</li>
                            )}
                            {exportPreviewData.filters.category && (
                              <li>Category: {exportPreviewData.filters.category}</li>
                            )}
                            {exportPreviewData.filters.payment_mode && (
                              <li>Mode: {exportPreviewData.filters.payment_mode}</li>
                            )}
                            {exportPreviewData.filters.collection_type && (
                              <li>
                                Type:{' '}
                                {REVENUE_COLLECTION_TYPES.find(
                                  (option) => option.value === exportPreviewData.filters.collection_type
                                )?.label || exportPreviewData.filters.collection_type}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {exportPreviewData.sample_data && exportPreviewData.sample_data.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">Sample Data (First 5 records)</h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              {Object.keys(exportPreviewData.sample_data[0]).slice(0, 5).map((key) => (
                                <th key={key} className="px-3 py-2 text-left text-slate-500 text-xs">
                                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {exportPreviewData.sample_data.map((row: any, idx: number) => (
                              <tr key={idx} className="text-slate-600">
                                {Object.values(row).slice(0, 5).map((val: any, i: number) => (
                                  <td key={i} className="px-3 py-2 text-xs">
                                    {typeof val === 'object' ? JSON.stringify(val).substring(0, 30) : String(val).substring(0, 30)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {exportPreviewData.record_count > 5 && (
                        <p className="text-xs text-slate-500 mt-2">
                          ... and {exportPreviewData.record_count - 5} more records
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/20">
                    <button
                      onClick={() => setShowExportPreview(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExportFromPreview}
                      disabled={isExporting}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center space-x-2"
                    >
                      {isExporting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>Export as {selectedExportFormat.toUpperCase()}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">Reports & Analytics</h1>
            <p className="page-subtitle">View comprehensive reports and analytics</p>
            <p className="text-xs text-slate-500 mt-1">Branch: {branchLabel}</p>
          </div>
          <button
            onClick={() => setShowBatchExport(true)}
            className="btn-primary self-start sm:self-auto flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Batch Export</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setActiveReport('attendance')}
            className="glass-card p-6 hover:bg-slate-100 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-300 transition-colors">
                Attendance Reports
              </h3>
              <svg
                className="w-6 h-6 text-slate-400 group-hover:text-blue-300 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 ">View student and staff attendance reports</p>
          </button>

          <button
            onClick={() => setActiveReport('academic')}
            className="glass-card p-6 hover:bg-slate-100 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-green-300 transition-colors">
                Academic Reports
              </h3>
              <svg
                className="w-6 h-6 text-slate-400 group-hover:text-green-300 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 ">Performance and examination reports</p>
          </button>

          {showRevenueReports && (
          <button
            onClick={() => setActiveReport('revenue')}
            className="glass-card p-6 hover:bg-slate-100 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-yellow-300 transition-colors">
                Revenue Reports
              </h3>
              <svg
                className="w-6 h-6 text-slate-400 group-hover:text-yellow-300 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 ">Fee collection and revenue analytics</p>
          </button>
          )}

          <button
            onClick={() => setActiveReport('expense')}
            className="glass-card p-6 hover:bg-slate-100 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                Expense Reports
              </h3>
              <svg
                className="w-6 h-6 text-slate-400 group-hover:text-red-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 ">Expense tracking and analysis</p>
          </button>

          <button
            onClick={() => setActiveReport('student')}
            className="glass-card p-6 hover:bg-slate-100 transition-all cursor-pointer text-left group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-cyan-300 transition-colors">
                Student Reports
              </h3>
              <svg
                className="w-6 h-6 text-slate-400 group-hover:text-cyan-300 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500 ">Complete student profile, attendance, fees, exams & transport</p>
          </button>
        </div>

        {/* Batch Export Modal */}
        {showBatchExport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="glass-card p-6 max-w-2xl w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="page-title">Batch Export Reports</h2>
                <button
                  onClick={() => {
                    setShowBatchExport(false)
                    setSelectedReports([])
                  }}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                  <p className="text-sm text-blue-200 mb-3">
                    Select multiple reports to export at once. All selected reports will be exported in the chosen format.
                  </p>
                  <div className="flex items-center space-x-2 mb-3">
                    <label className="label-text">Export Format:</label>
                    <SelectField
                      value={selectedExportFormat}
                      onChange={(e) => setSelectedExportFormat(e.target.value)}
                      className="px-3 py-1 border border-slate-200 rounded bg-white text-slate-900 border-slate-300"
                    >
                      <option value="csv">CSV</option>
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel</option>
                      <option value="json">JSON</option>
                    </SelectField>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-white">Select Reports:</h3>
                  {availableReportTypes.map((reportType) => (
                    <label
                      key={reportType}
                      className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedReports.includes(reportType)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReports([...selectedReports, reportType])
                          } else {
                            setSelectedReports(selectedReports.filter((r) => r !== reportType))
                          }
                        }}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-white capitalize">
                        {reportType === 'attendance' && 'Attendance Reports'}
                        {reportType === 'academic' && 'Academic Reports'}
                        {reportType === 'revenue' && 'Revenue Reports'}
                        {reportType === 'expense' && 'Expense Reports'}
                        {reportType === 'student' && 'Student Reports'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/20">
                  <button
                    onClick={() => {
                      setShowBatchExport(false)
                      setSelectedReports([])
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBatchExport}
                    disabled={selectedReports.length === 0 || isExporting}
                    className="px-4 py-2 bg-purple-600/90 text-slate-900 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center space-x-2"
                  >
                    {isExporting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Exporting {selectedReports.length} reports...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Export {selectedReports.length} Reports</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
