'use client'

import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { useTeacherDuty } from '@/contexts/TeacherDutyContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useMemo } from 'react'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterBadge,
  PageFilterField,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { getApiBaseUrl, withAuthConfig } from '@/lib/api'
import { buildBranchScopedHeaders } from '@/lib/branchAccess'
import { formatClassTeacherScopeLabel } from '@/lib/classTeacherScope'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { useRequirePageAccess } from '@/lib/usePageAccess'

type FaceAttendanceEvent = {
  id: number
  event_type: 'check_in' | 'check_out'
  event_time: string
  confidence_score?: number | null
  source?: string
  remarks?: string | null
}

type AttendanceHistoryRow =
  | {
      kind: 'event'
      id: number
      event_type: 'check_in' | 'check_out'
      event_time: string
      source?: string
      remarks?: string | null
    }
  | {
      kind: 'pending_logout'
      id: string
      after_login_id: number
      after_login_time: string
      attendance_date: string
      event_type: 'check_out'
      label: string
      logout_status?: string
    }

type StaffFaceDailySummary = {
  staff_id: number
  staff_name: string
  employee_id?: string
  email?: string
  login_count: number
  logout_count: number
  daily_status?: string | null
  daily_check_in_time?: string | null
  daily_check_out_time?: string | null
  daily_remarks?: string | null
  logout_status?: 'normal' | 'logout_missing' | 'corrected' | null
  logout_missing_date?: string | null
  total_work_minutes?: number
  total_work_hours_label?: string
  total_work_time_display?: string
  is_session_open?: boolean
  punctuality_status?: 'on_time' | 'late' | 'no_login'
  punctuality_label?: string
  first_login_time?: string | null
  first_login_time_display?: string | null
  expected_shift_start?: string
  late_minutes?: number | null
  early_minutes?: number | null
  events: FaceAttendanceEvent[]
  history?: AttendanceHistoryRow[]
  auto_absent?: boolean
  status_editable?: boolean
}

/** Remarks are collected only for these student attendance statuses. */
const STUDENT_STATUSES_REQUIRING_REMARKS = ['Absent', 'Late'] as const

function studentAttendanceNeedsRemarks(status: string): boolean {
  return STUDENT_STATUSES_REQUIRING_REMARKS.includes(
    status as (typeof STUDENT_STATUSES_REQUIRING_REMARKS)[number]
  )
}

const STUDENT_STATUS_OPTIONS = [
  { value: 'Present', label: 'Present', short: 'P', tone: 'present' as const },
  { value: 'Absent', label: 'Absent', short: 'A', tone: 'absent' as const },
  { value: 'Late', label: 'Late', short: 'L', tone: 'late' as const },
  { value: 'Excused', label: 'Excused', short: 'E', tone: 'excused' as const },
]

function studentStatusActiveClass(tone: (typeof STUDENT_STATUS_OPTIONS)[number]['tone']) {
  switch (tone) {
    case 'present':
      return 'bg-emerald-500/35 border-emerald-300/50 text-emerald-100 shadow-sm'
    case 'absent':
      return 'bg-red-500/35 border-red-300/50 text-red-100 shadow-sm'
    case 'late':
      return 'bg-amber-500/35 border-amber-300/50 text-amber-100 shadow-sm'
    case 'excused':
      return 'bg-violet-500/35 border-violet-300/50 text-violet-100 shadow-sm'
  }
}

function formatAdmissionDisplay(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
}

function StudentAttendanceStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (status: string) => void
  disabled?: boolean
}) {
  return (
    <div
      className="student-status-picker inline-flex flex-wrap gap-0.5 rounded-md border border-white/15 bg-black/20 p-0.5"
      role="group"
      aria-label="Attendance status"
    >
      {STUDENT_STATUS_OPTIONS.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? studentStatusActiveClass(option.tone)
                : 'border-transparent text-white/55 hover:bg-white/10 hover:text-white/90'
            }`}
          >
            {option.short}
          </button>
        )
      })}
    </div>
  )
}

function StudentStatusBadge({ status }: { status: string }) {
  const option = STUDENT_STATUS_OPTIONS.find((o) => o.value === status)
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold ${
        option ? studentStatusActiveClass(option.tone) : 'border-white/20 bg-white/10 text-white/80'
      }`}
    >
      {status}
    </span>
  )
}

const TEACHER_STATUS_OPTIONS = [
  { value: 'Present', label: 'Present', short: 'P', tone: 'present' as const },
  { value: 'Absent', label: 'Absent', short: 'A', tone: 'absent' as const },
  { value: 'Late', label: 'Late', short: 'L', tone: 'late' as const },
  { value: 'Half Day', label: 'Half Day', short: 'H', tone: 'half' as const },
]

function teacherStatusActiveClass(tone: (typeof TEACHER_STATUS_OPTIONS)[number]['tone']) {
  switch (tone) {
    case 'present':
      return 'bg-emerald-500/35 border-emerald-300/50 text-emerald-100 shadow-sm'
    case 'absent':
      return 'bg-red-500/35 border-red-300/50 text-red-100 shadow-sm'
    case 'late':
      return 'bg-amber-500/35 border-amber-300/50 text-amber-100 shadow-sm'
    case 'half':
      return 'bg-sky-500/35 border-sky-300/50 text-sky-100 shadow-sm'
  }
}

function TeacherAttendanceStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (status: string) => void
  disabled?: boolean
}) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-lg border border-white/15 bg-black/20 p-1"
      role="group"
      aria-label="Day status"
    >
      {TEACHER_STATUS_OPTIONS.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? teacherStatusActiveClass(option.tone)
                : 'border-transparent text-white/55 hover:bg-white/10 hover:text-white/90'
            }`}
          >
            <span className="sm:hidden">{option.short}</span>
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function formatEventTime(value: string) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return value
  }
}

function isAutoAttendanceRemarks(remarks?: string | null) {
  if (!remarks) return true
  const text = remarks.toLowerCase()
  return (
    text.includes('synced from face') ||
    text.includes('auto-marked') ||
    text.includes('auto check-in') ||
    text.includes('auto check-out') ||
    text.includes('face registration') ||
    text.includes('face recognition')
  )
}

function normalizeFaceDailySummary(
  payload: unknown,
  fallbackDate: string
): {
  date: string
  totals: { login_count: number; logout_count: number; staff_with_activity: number }
  data: StaffFaceDailySummary[]
} {
  const body = payload as {
    date?: string
    totals?: { login_count: number; logout_count: number; staff_with_activity: number }
    data?: unknown[]
  }
  const rows = Array.isArray(body?.data) ? body.data : []

  if (rows.length > 0 && rows[0] && typeof rows[0] === 'object' && 'events' in rows[0]) {
    const data = (rows as StaffFaceDailySummary[]).map((staff) => {
      const events = Array.isArray(staff.events) ? staff.events : []
      const login_count = staff.login_count ?? events.filter((e) => e.event_type === 'check_in').length
      const logout_count = staff.logout_count ?? events.filter((e) => e.event_type === 'check_out').length
      return { ...staff, events, login_count, logout_count }
    })
    const totals = body.totals ?? {
      login_count: data.reduce((sum, s) => sum + s.login_count, 0),
      logout_count: data.reduce((sum, s) => sum + s.logout_count, 0),
      staff_with_activity: data.filter((s) => s.events.length > 0).length,
    }
    return { date: body.date || fallbackDate, totals, data }
  }

  if (rows.length > 0 && rows[0] && typeof rows[0] === 'object' && 'event_type' in rows[0]) {
    const byStaff = new Map<number, StaffFaceDailySummary>()
    for (const log of rows as Array<{
      id: number
      staff_id: number
      staff_name?: string
      employee_id?: string
      event_type: 'check_in' | 'check_out'
      event_time: string
      confidence_score?: number | null
      source?: string
      remarks?: string | null
    }>) {
      if (!byStaff.has(log.staff_id)) {
        byStaff.set(log.staff_id, {
          staff_id: log.staff_id,
          staff_name: log.staff_name || `Staff #${log.staff_id}`,
          employee_id: log.employee_id,
          login_count: 0,
          logout_count: 0,
          events: [],
        })
      }
      const entry = byStaff.get(log.staff_id)!
      entry.events.push({
        id: log.id,
        event_type: log.event_type,
        event_time: log.event_time,
        confidence_score: log.confidence_score,
        source: log.source,
        remarks: log.remarks,
      })
      if (log.event_type === 'check_in') entry.login_count += 1
      else entry.logout_count += 1
    }
    const data = Array.from(byStaff.values()).sort((a, b) =>
      a.staff_name.localeCompare(b.staff_name)
    )
    return {
      date: body.date || fallbackDate,
      totals: {
        login_count: data.reduce((sum, s) => sum + s.login_count, 0),
        logout_count: data.reduce((sum, s) => sum + s.logout_count, 0),
        staff_with_activity: data.filter((s) => s.events.length > 0).length,
      },
      data,
    }
  }

  return {
    date: body.date || fallbackDate,
    totals: { login_count: 0, logout_count: 0, staff_with_activity: 0 },
    data: [],
  }
}

function logoutStatusLabel(status?: string | null) {
  if (status === 'logout_missing') return 'Logout missing'
  if (status === 'corrected') return 'Logout corrected'
  return null
}

type ShiftAdjustmentRecord = {
  id: number
  staff_id: number
  staff_name?: string | null
  employee_id?: string | null
  attendance_date: string
  adjustment_type: 'check_in' | 'check_out'
  requested_time: string
  approved_time?: string | null
  current_time?: string | null
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  review_remarks?: string | null
  reviewed_by_name?: string | null
  reviewed_at?: string | null
}

type MyShiftHistoryDay = {
  attendance_date: string
  status: string
  check_in_time: string | null
  check_out_time: string | null
  login_count: number
  logout_count: number
  total_work_time_display: string
  total_work_hours_label: string
  punctuality_label: string | null
  expected_shift_start: string
  is_session_open?: boolean
  has_activity: boolean
  is_future: boolean
  adjustments?: {
    check_in?: ShiftAdjustmentRecord
    check_out?: ShiftAdjustmentRecord
  }
}

function formatShiftListDate(dateStr: string) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString([], {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    })
  } catch {
    return dateStr
  }
}

function shiftStatusBadgeClass(status: string) {
  if (status === 'Present') return 'bg-green-100 text-green-800 border-green-200'
  if (status === 'Absent') return 'bg-red-100 text-red-800 border-red-200'
  if (status === 'Late') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (status === 'Half Day') return 'bg-sky-100 text-sky-800 border-sky-200'
  if (status === 'Excused') return 'bg-violet-100 text-violet-800 border-violet-200'
  return 'bg-slate-100 text-slate-500 border-slate-200'
}

function parseMonthFromDate(dateStr: string) {
  const [y, m] = dateStr.split('-').map(Number)
  return { year: y || new Date().getFullYear(), month: m || new Date().getMonth() + 1 }
}

function adjustmentTypeLabel(type: 'check_in' | 'check_out') {
  return type === 'check_in' ? 'Check-in' : 'Check-out'
}

function adjustmentStatusClass(status: string) {
  if (status === 'Pending') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (status === 'Approved') return 'bg-green-100 text-green-800 border-green-200'
  if (status === 'Rejected') return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

export default function AttendancePage() {
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth()
  const { academicYear, isLoading: yearLoading } = useAcademicYear()
  const { branch, isAllBranches } = useBranch()
  const branchScopeKey = isAllBranches ? 'all' : branch?.id ? String(branch.id) : 'none'
  const { classTeacherScopes, isClassTeacher, isLoading: dutyLoading, teacherId } = useTeacherDuty()
  const { hasFeature, canAccessPath, permissionsReady } = useSchoolFeatures()
  const { canAccess, accessLoading } = useRequirePageAccess('/attendance')
  const isTeacher = user?.role_name === 'Teacher'
  const queryClient = useQueryClient()

  const canManageTeacherAttendance =
    permissionsReady &&
    !isTeacher &&
    canAccessPath('/attendance') &&
    (hasFeature('attendance.module') ||
      hasFeature('attendance.teacher') ||
      hasFeature('attendance.edit'))

  const canMarkStudentAttendance =
    permissionsReady &&
    canAccessPath('/attendance') &&
    (hasFeature('attendance.module') ||
      hasFeature('attendance.mark') ||
      hasFeature('attendance.student')) &&
    (!isTeacher || isClassTeacher)

  const isOwnStaffAttendanceView = isTeacher && !canManageTeacherAttendance
  const showStudentTab = canMarkStudentAttendance
  const showTeacherTab = canManageTeacherAttendance || isOwnStaffAttendanceView
  const [activeTab, setActiveTab] = useState<'students' | 'teachers'>('students')

  useEffect(() => {
    if (!permissionsReady) return
    if (activeTab === 'students' && !showStudentTab && showTeacherTab) {
      setActiveTab('teachers')
    } else if (activeTab === 'teachers' && !showTeacherTab && showStudentTab) {
      setActiveTab('students')
    }
  }, [permissionsReady, showStudentTab, showTeacherTab, activeTab])

  const [historyEdit, setHistoryEdit] = useState<{
    staffId: number
    staffName: string
    row: AttendanceHistoryRow
  } | null>(null)
  const [historyEditTime, setHistoryEditTime] = useState('')
  
  // Student attendance filters
  const [studentFilters, setStudentFilters] = useState({
    class_id: '',
    section_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
  })
  
  // Teacher attendance filters
  const [teacherFilters, setTeacherFilters] = useState({
    attendance_date: new Date().toISOString().split('T')[0],
    expected_shift_start: '09:00',
  })

  const [shiftHistoryMonth, setShiftHistoryMonth] = useState(() =>
    parseMonthFromDate(new Date().toISOString().split('T')[0])
  )

  const [adjustmentModal, setAdjustmentModal] = useState<{
    attendance_date: string
    adjustment_type: 'check_in' | 'check_out'
    current_time: string | null
  } | null>(null)
  const [adjustmentForm, setAdjustmentForm] = useState({ requested_time: '', reason: '' })

  const [adminReviewModal, setAdminReviewModal] = useState<{
    request: ShiftAdjustmentRecord
    mode: 'approve' | 'reject'
  } | null>(null)
  const [adminReviewForm, setAdminReviewForm] = useState({
    approved_time: '',
    review_remarks: '',
  })

  useEffect(() => {
    if (!isOwnStaffAttendanceView) return
    setShiftHistoryMonth(parseMonthFromDate(teacherFilters.attendance_date))
  }, [teacherFilters.attendance_date, isOwnStaffAttendanceView])

  const scopedHeaders = useMemo(
    () =>
      buildBranchScopedHeaders(token || '', {
        academicYearId: academicYear?.id,
        branchId: branch?.id,
        isAllBranches,
      }),
    [token, academicYear?.id, branch?.id, isAllBranches]
  )

  useEffect(() => {
    setStudentFilters((prev) => ({ ...prev, class_id: '', section_id: '' }))
    setStudentAttendance({})
  }, [branchScopeKey, academicYear?.id])

  // Fetch classes
  const { data: classes } = useQuery(
    ['classes', 'attendance', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiBaseUrl()}/classes`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    {
      enabled:
        !!user &&
        !!token &&
        !!academicYear &&
        !yearLoading &&
        permissionsReady &&
        canMarkStudentAttendance &&
        activeTab === 'students',
    }
  )

  const classTeacherLabel = formatClassTeacherScopeLabel(classTeacherScopes)

  const visibleClasses = useMemo(() => {
    if (!classes) return []
    let list = classes as Array<{ id: number; name: string; level?: number }>
    if (isTeacher && isClassTeacher) {
      const allowedClassIds = new Set(classTeacherScopes.map((s) => Number(s.class_id)))
      list = list.filter((cls) => allowedClassIds.has(Number(cls.id)))
    }
    return [...list].sort((a, b) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      if (levelA !== levelB) return levelA - levelB
      return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
    })
  }, [classes, isTeacher, isClassTeacher, classTeacherScopes])

  useEffect(() => {
    if (!isTeacher || !isClassTeacher || classTeacherScopes.length === 0) return
    const scope = classTeacherScopes[0]
    setStudentFilters((prev) => ({
      ...prev,
      class_id: String(scope.class_id),
      section_id: String(scope.section_id),
    }))
  }, [isTeacher, isClassTeacher, classTeacherScopes])

  // Fetch sections based on selected class
  const { data: sections } = useQuery(
    ['sections', 'attendance', studentFilters.class_id, academicYear?.id, branchScopeKey],
    async () => {
      if (!studentFilters.class_id) return []
      const response = await axios.get(`${getApiBaseUrl()}/sections`, {
        params: {
          class_id: studentFilters.class_id,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    {
      enabled:
        !!user &&
        !!academicYear &&
        !!studentFilters.class_id &&
        permissionsReady &&
        canMarkStudentAttendance &&
        activeTab === 'students',
    }
  )

  // Fetch students for attendance marking
  const { data: students, refetch: refetchStudents } = useQuery(
    [
      'students-for-attendance',
      studentFilters.class_id,
      studentFilters.section_id,
      academicYear?.id,
      branchScopeKey,
    ],
    async () => {
      if (!studentFilters.class_id) return []
      const response = await axios.get(`${getApiBaseUrl()}/students`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          class_id: studentFilters.class_id,
          section_id: studentFilters.section_id || undefined,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    {
      enabled:
        !!user &&
        !!academicYear &&
        !!studentFilters.class_id &&
        permissionsReady &&
        canMarkStudentAttendance &&
        activeTab === 'students',
    }
  )

  type StudentRegisterLock = {
    is_locked: boolean
    can_edit: boolean
    locked_at?: string | null
    locked_by_name?: string | null
    locked_by_role?: string | null
  }

  // Fetch existing student attendance for the selected date
  const { data: studentAttendanceBundle } = useQuery(
    [
      'student-attendance',
      studentFilters.attendance_date,
      studentFilters.class_id,
      studentFilters.section_id,
      academicYear?.id,
      branchScopeKey,
    ],
    async () => {
      if (!studentFilters.class_id || !studentFilters.attendance_date) {
        return { records: [] as unknown[], register_lock: { is_locked: false, can_edit: true } as StudentRegisterLock }
      }
      const response = await axios.get(`${getApiBaseUrl()}/attendance/students`, {
        params: {
          class_id: studentFilters.class_id,
          section_id: studentFilters.section_id || undefined,
          start_date: studentFilters.attendance_date,
          end_date: studentFilters.attendance_date,
        },
        headers: scopedHeaders,
      })
      const register_lock: StudentRegisterLock = response.data.register_lock ?? {
        is_locked: false,
        can_edit: true,
      }
      return { records: response.data.data ?? [], register_lock }
    },
    {
      enabled:
        !!user &&
        !!academicYear &&
        !!studentFilters.class_id &&
        !!studentFilters.attendance_date &&
        permissionsReady &&
        canMarkStudentAttendance &&
        activeTab === 'students',
    }
  )

  const existingStudentAttendance = studentAttendanceBundle?.records
  const studentRegisterLock = studentAttendanceBundle?.register_lock
  const canEditStudentRegister = studentRegisterLock?.can_edit !== false

  // Fetch teachers (school admin view only — teachers use my-staff-face-summary)
  const { data: teachers, refetch: refetchTeachers } = useQuery(
    ['teachers-for-attendance', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiBaseUrl()}/teachers`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    {
      enabled:
        !!user &&
        !!token &&
        !!academicYear?.id &&
        !yearLoading &&
        permissionsReady &&
        activeTab === 'teachers' &&
        !isOwnStaffAttendanceView,
    }
  )

  // Fetch existing teacher attendance for the selected date
  const { data: existingTeacherAttendance } = useQuery(
    ['teacher-attendance', teacherFilters.attendance_date],
    async () => {
      if (!teacherFilters.attendance_date) return []
      const response = await axios.get(`${getApiBaseUrl()}/attendance/staff`, {
        params: {
          start_date: teacherFilters.attendance_date,
          end_date: teacherFilters.attendance_date,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': academicYear?.id,
        },
      })
      return response.data.data
    },
    {
      enabled:
        !!user &&
        !!academicYear &&
        !!teacherFilters.attendance_date &&
        permissionsReady &&
        canManageTeacherAttendance &&
        activeTab === 'teachers',
    }
  )

  const { data: faceDailySummary, isLoading: faceSummaryLoading, error: faceSummaryError } = useQuery(
    [
      'face-attendance-daily-summary',
      isOwnStaffAttendanceView ? 'self' : 'all',
      user?.school_id,
      academicYear?.id,
      teacherFilters.attendance_date,
      teacherFilters.expected_shift_start,
      teacherId,
    ],
    async () => {
      const params = {
        view: 'daily-summary',
        date: teacherFilters.attendance_date,
        expected_shift_start: teacherFilters.expected_shift_start,
      }

      const requestConfig = withAuthConfig({ params }, token, academicYear?.id)

      if (isOwnStaffAttendanceView) {
        const response = await axios.get(
          `${getApiBaseUrl()}/attendance/my-staff-face-summary`,
          requestConfig
        )
        const normalized = normalizeFaceDailySummary(response.data, teacherFilters.attendance_date)
        return {
          ...normalized,
          expected_shift_start:
            response.data?.expected_shift_start || teacherFilters.expected_shift_start,
        }
      }

      try {
        const response = await axios.get(
          `${getApiBaseUrl()}/face-registration/attendance-logs`,
          requestConfig
        )
        const normalized = normalizeFaceDailySummary(response.data, teacherFilters.attendance_date)
        return {
          ...normalized,
          expected_shift_start:
            response.data?.expected_shift_start || teacherFilters.expected_shift_start,
        }
      } catch (firstError: any) {
        if (firstError?.response?.status === 403) {
          return normalizeFaceDailySummary({ data: [] }, teacherFilters.attendance_date)
        }
        if (firstError?.response?.status !== 404) {
          throw firstError
        }
        const fallback = await axios.get(
          `${getApiBaseUrl()}/face-registration/daily-attendance-summary`,
          requestConfig
        )
        const normalized = normalizeFaceDailySummary(fallback.data, teacherFilters.attendance_date)
        return {
          ...normalized,
          expected_shift_start:
            fallback.data?.expected_shift_start || teacherFilters.expected_shift_start,
        }
      }
    },
    {
      enabled:
        isAuthenticated &&
        !authLoading &&
        !yearLoading &&
        permissionsReady &&
        !!academicYear?.id &&
        !!teacherFilters.attendance_date &&
        activeTab === 'teachers' &&
        (canManageTeacherAttendance || isOwnStaffAttendanceView),
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403) return false
        return failureCount < 1
      },
    }
  )

  const { data: myShiftHistory, isLoading: shiftHistoryLoading } = useQuery(
    [
      'my-staff-shift-history',
      teacherId,
      shiftHistoryMonth.year,
      shiftHistoryMonth.month,
      academicYear?.id,
      teacherFilters.expected_shift_start,
    ],
    async () => {
      const response = await axios.get(`${getApiBaseUrl()}/attendance/my-staff-shift-history`, {
        params: {
          year: shiftHistoryMonth.year,
          month: shiftHistoryMonth.month,
          expected_shift_start: teacherFilters.expected_shift_start,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': academicYear!.id.toString(),
        },
      })
      return response.data as {
        month_label: string
        expected_shift_start: string
        days: MyShiftHistoryDay[]
      }
    },
    {
      enabled:
        isAuthenticated &&
        !authLoading &&
        !yearLoading &&
        isOwnStaffAttendanceView &&
        !!teacherId &&
        !!academicYear?.id &&
        activeTab === 'teachers',
      staleTime: 30_000,
    }
  )

  const changeShiftHistoryMonth = (delta: number) => {
    setShiftHistoryMonth((prev) => {
      let month = prev.month + delta
      let year = prev.year
      if (month < 1) {
        month = 12
        year -= 1
      } else if (month > 12) {
        month = 1
        year += 1
      }
      return { year, month }
    })
  }

  const selectedDayShift = myShiftHistory?.days?.find(
    (d) => d.attendance_date === teacherFilters.attendance_date
  )
  const selectedDayAdjustments = selectedDayShift?.adjustments || {}

  const { data: pendingShiftAdjustments } = useQuery(
    ['shift-adjustments-pending', academicYear?.id],
    async () => {
      const response = await axios.get(`${getApiBaseUrl()}/attendance/shift-adjustments`, {
        params: { status: 'Pending' },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': academicYear!.id.toString(),
        },
      })
      return (response.data.data || []) as ShiftAdjustmentRecord[]
    },
    {
      enabled: canManageTeacherAttendance && !!academicYear?.id && activeTab === 'teachers',
      refetchInterval: 60_000,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403) return false
        return failureCount < 1
      },
    }
  )

  const invalidateShiftQueries = () => {
    queryClient.invalidateQueries(['my-staff-shift-history'])
    queryClient.invalidateQueries(['shift-adjustments-pending'])
    queryClient.invalidateQueries(['face-attendance-daily-summary'])
    queryClient.invalidateQueries(['teacher-attendance'])
  }

  const submitShiftAdjustment = useMutation(
    async () => {
      if (!adjustmentModal) return
      const response = await axios.post(
        `${getApiBaseUrl()}/attendance/shift-adjustments`,
        {
          attendance_date: adjustmentModal.attendance_date,
          adjustment_type: adjustmentModal.adjustment_type,
          requested_time: adjustmentForm.requested_time,
          reason: adjustmentForm.reason.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear!.id.toString(),
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        invalidateShiftQueries()
        setAdjustmentModal(null)
        setAdjustmentForm({ requested_time: '', reason: '' })
        alert('Adjustment request submitted. You will be notified after review.')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to submit request')
      },
    }
  )

  const approveShiftAdjustment = useMutation(
    async (payload: { id: number; approved_time: string; review_remarks: string }) => {
      const response = await axios.put(
        `${getApiBaseUrl()}/attendance/shift-adjustments/${payload.id}/approve`,
        {
          approved_time: payload.approved_time,
          review_remarks: payload.review_remarks || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear!.id.toString(),
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        invalidateShiftQueries()
        setAdminReviewModal(null)
        alert('Adjustment approved and shift times updated.')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to approve')
      },
    }
  )

  const rejectShiftAdjustment = useMutation(
    async (payload: { id: number; review_remarks: string }) => {
      const response = await axios.put(
        `${getApiBaseUrl()}/attendance/shift-adjustments/${payload.id}/reject`,
        { review_remarks: payload.review_remarks || undefined },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear!.id.toString(),
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        invalidateShiftQueries()
        setAdminReviewModal(null)
        alert('Adjustment request rejected.')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to reject')
      },
    }
  )

  const openAdjustmentRequest = (
    attendanceDate: string,
    adjustmentType: 'check_in' | 'check_out',
    currentTime: string | null
  ) => {
    setAdjustmentModal({
      attendance_date: attendanceDate,
      adjustment_type: adjustmentType,
      current_time: currentTime,
    })
    setAdjustmentForm({
      requested_time: currentTime || '',
      reason: '',
    })
  }

  const openAdminReview = (request: ShiftAdjustmentRecord, mode: 'approve' | 'reject') => {
    setAdminReviewModal({ request, mode })
    setAdminReviewForm({
      approved_time: request.requested_time,
      review_remarks: '',
    })
  }

  const patchAttendanceLogMutation = useMutation(
    async (payload: { logId: number; attendance_date: string; time: string }) => {
      const apiBase = getApiBaseUrl()
      const response = await axios.post(
        `${apiBase}/attendance/staff-face-logs/update-time`,
        {
          log_id: payload.logId,
          attendance_date: payload.attendance_date,
          time: payload.time,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear!.id.toString(),
            'Content-Type': 'application/json',
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['face-attendance-daily-summary'])
        queryClient.invalidateQueries(['teacher-attendance'])
        setHistoryEdit(null)
        alert('Attendance log updated.')
      },
      onError: (error: any) => {
        const message =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to update log'
        alert(message)
      },
    }
  )

  const addLogoutMutation = useMutation(
    async (payload: {
      staff_id: number
      attendance_date: string
      check_out_time: string
      useLogoutStatusPatch?: boolean
    }) => {
      const apiBase = getApiBaseUrl()
      if (payload.useLogoutStatusPatch) {
        const response = await axios.patch(
          `${apiBase}/face-registration/staff-attendance/logout-status`,
          {
            staff_id: payload.staff_id,
            attendance_date: payload.attendance_date,
            check_out_time: payload.check_out_time,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'academic-year-id': academicYear!.id.toString(),
            },
          }
        )
        return response.data
      }
      const response = await axios.post(
        `${apiBase}/attendance/staff-face-logs/add-logout`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear!.id.toString(),
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['face-attendance-daily-summary'])
        queryClient.invalidateQueries(['teacher-attendance'])
        setHistoryEdit(null)
        alert('Logout time saved.')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to add logout time')
      },
    }
  )

  // Student attendance state
  const [studentAttendance, setStudentAttendance] = useState<Record<number, { status: string; remarks: string }>>({})
  const [studentAttendanceEditing, setStudentAttendanceEditing] = useState(false)

  // Teacher attendance state (status only — times live in face history)
  const [teacherAttendance, setTeacherAttendance] = useState<
    Record<number, { status: string; remarks: string }>
  >({})
  // Load existing attendance into state
  useEffect(() => {
    if (existingStudentAttendance && students) {
      const attendanceMap: Record<number, { status: string; remarks: string }> = {}
      existingStudentAttendance.forEach((att: any) => {
        const status = att.status || 'Present'
        attendanceMap[att.student_id] = {
          status,
          remarks: studentAttendanceNeedsRemarks(status) ? att.remarks || '' : '',
        }
      })
      setStudentAttendance(attendanceMap)
    } else if (students) {
      // Initialize with default values
      const attendanceMap: Record<number, { status: string; remarks: string }> = {}
      students.forEach((student: any) => {
        attendanceMap[student.id] = {
          status: 'Present',
          remarks: '',
        }
      })
      setStudentAttendance(attendanceMap)
    }
  }, [existingStudentAttendance, students])

  useEffect(() => {
    setStudentAttendanceEditing(false)
  }, [studentFilters.class_id, studentFilters.section_id, studentFilters.attendance_date])

  const hasSavedStudentAttendance = useMemo(() => {
    if (studentRegisterLock?.is_locked) return true
    const savedCount = existingStudentAttendance?.length ?? 0
    return savedCount > 0 && (students?.length ?? 0) > 0
  }, [studentRegisterLock?.is_locked, existingStudentAttendance?.length, students?.length])

  const isStudentAttendanceEditable =
    canEditStudentRegister && (!hasSavedStudentAttendance || studentAttendanceEditing)

  const handleCancelStudentAttendanceEdit = () => {
    setStudentAttendanceEditing(false)
    if (existingStudentAttendance && students) {
      const attendanceMap: Record<number, { status: string; remarks: string }> = {}
      existingStudentAttendance.forEach((att: { student_id: number; status?: string; remarks?: string }) => {
        const status = att.status || 'Present'
        attendanceMap[att.student_id] = {
          status,
          remarks: studentAttendanceNeedsRemarks(status) ? att.remarks || '' : '',
        }
      })
      setStudentAttendance(attendanceMap)
    }
  }

  useEffect(() => {
    const staffList = faceDailySummary?.data?.length
      ? faceDailySummary.data
      : (teachers || []).map((t: any) => ({
          staff_id: t.id,
          staff_name: t.name,
          employee_id: t.employee_id,
          events: [],
          login_count: 0,
          logout_count: 0,
        }))

    if (!staffList.length) return

    const attendanceMap: Record<number, { status: string; remarks: string }> = {}

    staffList.forEach((staff: StaffFaceDailySummary) => {
      const staffId = staff.staff_id
      const existing = existingTeacherAttendance?.find((att: any) => att.staff_id === staffId)
      let status = staff.daily_status || 'Present'

      if (existing?.status && existing.marked_by && !isAutoAttendanceRemarks(existing.remarks)) {
        status = existing.status
      } else if (staff.auto_absent) {
        status = 'Absent'
      }

      attendanceMap[staffId] = {
        status,
        remarks: (existing?.remarks || staff.daily_remarks || '').replace(/\s*\|.*$/, '').trim(),
      }
    })

    setTeacherAttendance(attendanceMap)
  }, [faceDailySummary?.data, existingTeacherAttendance, teachers])

  // Mark student attendance mutation
  const markStudentAttendance = useMutation(
    async () => {
      if (!students || students.length === 0) return
      if (!canEditStudentRegister) {
        throw new Error(
          'Attendance for this class and date is locked. Contact staff with attendance edit permission to make changes.'
        )
      }

      for (const student of students) {
        const status = studentAttendance[student.id]?.status || 'Present'
        const remarks = (studentAttendance[student.id]?.remarks || '').trim()
        if (studentAttendanceNeedsRemarks(status) && !remarks) {
          const name = [student.first_name, student.last_name].filter(Boolean).join(' ')
          throw new Error(
            `Remarks are required for ${status} — please add a remark for ${name || 'this student'}.`
          )
        }
      }

      const attendance_data = students.map((student: any) => {
        const status = studentAttendance[student.id]?.status || 'Present'
        return {
          student_id: student.id,
          status,
          remarks: studentAttendanceNeedsRemarks(status)
            ? (studentAttendance[student.id]?.remarks || '').trim()
            : null,
        }
      })

      const response = await axios.post(
        `${getApiBaseUrl()}/attendance/students`,
        {
          attendance_date: studentFilters.attendance_date,
          attendance_data,
          class_id: studentFilters.class_id,
          section_id: studentFilters.section_id || null,
        },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: (data: { message?: string; locked?: boolean }) => {
        setStudentAttendanceEditing(false)
        queryClient.invalidateQueries(['student-attendance'])
        alert(
          data?.message ||
            (data?.locked
              ? 'Attendance saved successfully. Click Edit to make changes.'
              : 'Student attendance marked successfully!')
        )
      },
      onError: (error: any) => {
        console.error('Mark attendance error:', error)
        alert(
          error.message ||
            error.response?.data?.error ||
            'Failed to mark attendance'
        )
      },
    }
  )

  const buildTeacherAttendancePayload = (staffIds: number[]) =>
    staffIds.map((staffId) => ({
      staff_id: staffId,
      status: teacherAttendance[staffId]?.status || 'Present',
      remarks: teacherAttendance[staffId]?.remarks || '',
    }))

  const postTeacherAttendance = async (staffIds: number[]) => {
    const response = await axios.post(
      `${getApiBaseUrl()}/attendance/staff`,
      {
        attendance_date: teacherFilters.attendance_date,
        attendance_data: buildTeacherAttendancePayload(staffIds),
      },
      { headers: scopedHeaders }
    )
    return response.data
  }

  const markTeacherAttendance = useMutation(
    async (staffIds?: number[]) => {
      const list = faceDailySummary?.data || []
      const ids =
        staffIds ||
        list.map((s) => s.staff_id) ||
        (teachers || []).map((t: any) => t.id)
      if (!ids.length) return
      return postTeacherAttendance(ids)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['teacher-attendance'])
        queryClient.invalidateQueries(['face-attendance-daily-summary'])
        alert('Teacher attendance saved successfully!')
      },
      onError: (error: any) => {
        console.error('Mark attendance error:', error)
        alert(error.response?.data?.error || 'Failed to mark attendance')
      },
    }
  )

  const handleStudentStatusChange = (studentId: number, status: string) => {
    setStudentAttendance((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        remarks: studentAttendanceNeedsRemarks(status) ? prev[studentId]?.remarks || '' : '',
      },
    }))
  }

  const handleStudentRemarksChange = (studentId: number, remarks: string) => {
    setStudentAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remarks,
      },
    }))
  }

  const handleTeacherStatusChange = (teacherId: number, status: string) => {
    setTeacherAttendance((prev) => ({
      ...prev,
      [teacherId]: {
        status,
        remarks: prev[teacherId]?.remarks || '',
      },
    }))
  }

  const handleTeacherRemarksChange = (teacherId: number, remarks: string) => {
    setTeacherAttendance((prev) => ({
      ...prev,
      [teacherId]: {
        status: prev[teacherId]?.status || 'Present',
        remarks,
      },
    }))
  }

  const openHistoryEdit = (staff: StaffFaceDailySummary, row: AttendanceHistoryRow) => {
    setHistoryEdit({ staffId: staff.staff_id, staffName: staff.staff_name, row })
    if (row.kind === 'event') {
      const raw = row.event_time
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw)) {
        setHistoryEditTime(raw.slice(11, 16))
      } else {
        const d = new Date(raw)
        if (Number.isNaN(d.getTime())) {
          setHistoryEditTime('')
        } else {
          const hours = String(d.getHours()).padStart(2, '0')
          const minutes = String(d.getMinutes()).padStart(2, '0')
          setHistoryEditTime(`${hours}:${minutes}`)
        }
      }
    } else {
      setHistoryEditTime('18:00')
    }
  }

  const submitHistoryEdit = () => {
    if (!historyEdit || !canManageTeacherAttendance) return
    const { row, staffId } = historyEdit

    if (row.kind === 'pending_logout') {
      const date = row.attendance_date || teacherFilters.attendance_date
      const usePatch = date !== teacherFilters.attendance_date
      addLogoutMutation.mutate({
        staff_id: staffId,
        attendance_date: date,
        check_out_time: historyEditTime.length === 5 ? `${historyEditTime}:00` : historyEditTime,
        useLogoutStatusPatch: usePatch,
      })
      return
    }

    const timePart =
      historyEditTime.length === 5 ? `${historyEditTime}:00` : historyEditTime
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timePart)) {
      alert('Please enter a valid time (HH:MM).')
      return
    }

    const logId = Number(row.id)
    if (!Number.isFinite(logId) || logId < 1) {
      alert('This history entry cannot be edited.')
      return
    }

    patchAttendanceLogMutation.mutate({
      logId,
      attendance_date: teacherFilters.attendance_date,
      time: timePart,
    })
  }

  const getStaffHistory = (staff: StaffFaceDailySummary): AttendanceHistoryRow[] => {
    if (staff.history?.length) return staff.history
    const events = staff.events ?? []
    return events.map((e) => ({
      kind: 'event' as const,
      id: e.id,
      event_type: e.event_type,
      event_time: e.event_time,
      source: e.source,
      remarks: e.remarks,
    }))
  }

  const handleBulkStudentAction = (status: string) => {
    if (!students) return
    const newAttendance: Record<number, { status: string; remarks: string }> = {}
    students.forEach((student: any) => {
      newAttendance[student.id] = {
        status,
        remarks: studentAttendanceNeedsRemarks(status)
          ? studentAttendance[student.id]?.remarks || ''
          : '',
      }
    })
    setStudentAttendance(newAttendance)
  }

  const handleBulkTeacherAction = (status: string) => {
    if (!teacherStaffList.length) return
    const newAttendance: Record<number, { status: string; remarks: string }> = {}
    teacherStaffList.forEach((staff) => {
      const locked = !!staff.auto_absent && !canManageTeacherAttendance
      if (locked) return
      newAttendance[staff.staff_id] = {
        status,
        remarks: teacherAttendance[staff.staff_id]?.remarks || '',
      }
    })
    setTeacherAttendance((prev) => ({ ...prev, ...newAttendance }))
  }

  const teacherStaffList: StaffFaceDailySummary[] = useMemo(() => {
    if (faceDailySummary?.data?.length) {
      const rows = faceDailySummary.data
      if (isOwnStaffAttendanceView && teacherId) {
        return rows.filter((row) => Number(row.staff_id) === Number(teacherId))
      }
      return rows
    }
    if (isOwnStaffAttendanceView) {
      return []
    }
    return (teachers || []).map((t: any) => ({
      staff_id: t.id,
      staff_name: t.name,
      employee_id: t.employee_id,
      login_count: 0,
      logout_count: 0,
      events: [],
    }))
  }, [faceDailySummary?.data, teachers, isOwnStaffAttendanceView, teacherId])

  const attendanceExportCount =
    activeTab === 'students'
      ? studentFilters.class_id
        ? students?.length ?? 0
        : 0
      : teacherStaffList.length

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: activeTab === 'students' ? 'Student Attendance' : 'Teacher Attendance',
      filename: activeTab === 'students' ? 'student_attendance' : 'teacher_attendance',
      getSubtitle: () => {
        if (activeTab === 'students') {
          return `Date: ${studentFilters.attendance_date}`
        }
        return `Date: ${teacherFilters.attendance_date}`
      },
      columns:
        activeTab === 'students'
          ? [
              { key: 'roll_number', label: 'Roll No.' },
              { key: 'name', label: 'Student' },
              { key: 'admission_number', label: 'Admission No.' },
              { key: 'status', label: 'Status' },
              { key: 'remarks', label: 'Remarks' },
            ]
          : [
              { key: 'staff_name', label: 'Staff' },
              { key: 'employee_id', label: 'Employee ID' },
              { key: 'login_count', label: 'Logins' },
              { key: 'logout_count', label: 'Logouts' },
              { key: 'status', label: 'Status' },
            ],
      getRows: () => {
        if (activeTab === 'students') {
          return (students || []).map((s: any) => ({
            roll_number: s.roll_number || '',
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
            admission_number: s.admission_number || '',
            status: studentAttendance[s.id]?.status || 'Present',
            remarks: studentAttendance[s.id]?.remarks || '',
          }))
        }
        return teacherStaffList.map((staff) => ({
          staff_name: staff.staff_name || '',
          employee_id: staff.employee_id || '',
          login_count: staff.login_count ?? 0,
          logout_count: staff.logout_count ?? 0,
          status: teacherAttendance[staff.staff_id]?.status || (staff.login_count ? 'Present' : 'Absent'),
        }))
      },
    },
  })

  const attendanceTabClass = (active: boolean) =>
    `px-2 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${
      active
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`

  if (accessLoading || !canAccess) {
    return null
  }

  if (permissionsReady && !showStudentTab && !showTeacherTab) {
    return (
      <Layout>
        <div className="page-container">
          <div className="glass-card p-4 text-sm text-amber-100">
            No attendance permissions are enabled for your role. Ask School Admin to grant Attendance
            features under <strong>Features</strong>.
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="attendance-page-layout gap-2">
        <div className="table-shell attendance-page-shell flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 attendance-toolbar">
            <div className="attendance-unified-toolbar-row">
              <div className="attendance-toolbar-meta shrink-0">
                <h1 className="text-sm font-semibold text-white leading-none">Attendance</h1>
                <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                  {activeTab === 'students'
                    ? studentFilters.class_id && students?.length
                      ? `${students.length} students`
                      : 'Select class'
                    : `${teacherStaffList.length} staff`}
                </p>
              </div>

              <div className="attendance-toolbar-divider" aria-hidden />

              <div className="attendance-tab-switch shrink-0 flex gap-0.5 p-0.5 rounded-md border border-white/10 bg-black/15" role="tablist">
                {showStudentTab && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'students'}
                    onClick={() => setActiveTab('students')}
                    className={attendanceTabClass(activeTab === 'students')}
                  >
                    Students
                  </button>
                )}
                {showTeacherTab && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'teachers'}
                    onClick={() => setActiveTab('teachers')}
                    className={attendanceTabClass(activeTab === 'teachers')}
                  >
                    {isOwnStaffAttendanceView ? 'My logs' : 'Teachers'}
                  </button>
                )}
              </div>

              {activeTab === 'students' && (
                <>
                  {isTeacher && isClassTeacher ? (
                    <PageFilterField label="Class" hideLabel className="attendance-toolbar-badge">
                      <PageFilterBadge className="attendance-scope-badge">{classTeacherLabel || '—'}</PageFilterBadge>
                    </PageFilterField>
                  ) : (
                    <>
                      <PageFilterField label="Class" hideLabel required className="attendance-toolbar-select">
                        <SelectField
                          value={studentFilters.class_id}
                          onChange={(e) => {
                            setStudentFilters((prev) => ({ ...prev, class_id: e.target.value, section_id: '' }))
                            setStudentAttendance({})
                          }}
                          className="select-field w-full"
                          aria-label="Class"
                        >
                          <option value="">Class</option>
                          {visibleClasses.map((cls: { id: number; name: string }) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </SelectField>
                      </PageFilterField>

                      <PageFilterField label="Section" hideLabel className="attendance-toolbar-select">
                        <SelectField
                          value={studentFilters.section_id}
                          onChange={(e) => {
                            setStudentFilters((prev) => ({ ...prev, section_id: e.target.value }))
                            setStudentAttendance({})
                          }}
                          disabled={!studentFilters.class_id}
                          className="select-field w-full disabled:opacity-50"
                          aria-label="Section"
                        >
                          <option value="">Section</option>
                          {sections?.map((sec: { id: number; name: string }) => (
                            <option key={sec.id} value={sec.id}>
                              {sec.name}
                            </option>
                          ))}
                        </SelectField>
                      </PageFilterField>
                    </>
                  )}

                  <PageFilterField id="student_attendance_date" label="Date" hideLabel required className="attendance-toolbar-date">
                    <input
                      id="student_attendance_date"
                      type="date"
                      value={studentFilters.attendance_date}
                      onChange={(e) => {
                        setStudentFilters((prev) => ({ ...prev, attendance_date: e.target.value }))
                        setStudentAttendance({})
                      }}
                      className="input-field w-full"
                      aria-label="Attendance date"
                    />
                  </PageFilterField>
                </>
              )}

              {activeTab === 'teachers' && (
                <>
                  <PageFilterField label="Date" hideLabel required className="attendance-toolbar-date">
                    <input
                      type="date"
                      value={teacherFilters.attendance_date}
                      onChange={(e) => {
                        setTeacherFilters((prev) => ({ ...prev, attendance_date: e.target.value }))
                        setTeacherAttendance({})
                      }}
                      className="input-field w-full"
                      aria-label="Attendance date"
                    />
                  </PageFilterField>
                  {!isOwnStaffAttendanceView && (
                    <PageFilterField label="Shift" hideLabel className="attendance-toolbar-time">
                      <input
                        type="time"
                        value={teacherFilters.expected_shift_start}
                        onChange={(e) =>
                          setTeacherFilters((prev) => ({
                            ...prev,
                            expected_shift_start: e.target.value,
                          }))
                        }
                        title="On-time benchmark for first login"
                        className="input-field w-full"
                        aria-label="Shift start time"
                      />
                    </PageFilterField>
                  )}
                </>
              )}

              <div className="attendance-toolbar-actions shrink-0 ml-auto">
                <ExportMenu
                  onExport={handleExport}
                  isExporting={isExporting}
                  recordCount={attendanceExportCount}
                  size="sm"
                />
              </div>
            </div>
            {exportError ? (
              <p className="mt-1 text-[11px] text-red-200" role="alert">
                {exportError}
              </p>
            ) : null}
          </div>

        {/* Student Attendance Tab */}
        {activeTab === 'students' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {isTeacher && !dutyLoading && !isClassTeacher && (
              <div className="alert-info shrink-0 mx-2 mt-2 py-1.5 px-2">
                <p className="text-xs">
                  Student attendance is available only when you are assigned as <strong>Class Teacher</strong>.
                </p>
              </div>
            )}

            {studentFilters.class_id && students && students.length > 0 && (
              <div className="attendance-page-table flex-1 min-h-0 flex flex-col">
                {hasSavedStudentAttendance && !studentAttendanceEditing && (
                  <div className={`shrink-0 mx-2 mt-2 rounded-md border px-2 py-1.5 text-[11px] ${canEditStudentRegister ? 'alert-warning' : 'alert-info'}`}>
                    {canEditStudentRegister ? (
                      <p>
                        Attendance has been saved for this class and date. Click <strong>Edit</strong> to
                        make changes.
                        {studentRegisterLock?.locked_by_name ? (
                          <>
                            {' '}
                            Saved by {studentRegisterLock.locked_by_name}
                            {studentRegisterLock.locked_at
                              ? ` on ${new Date(studentRegisterLock.locked_at).toLocaleString()}`
                              : ''}
                            .
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p>
                        Attendance for this class, section, and date has been submitted and is{' '}
                        <strong>locked</strong>. Contact staff with attendance edit permission to make changes.
                        {studentRegisterLock?.locked_by_name ? (
                          <>
                            {' '}
                            Submitted by {studentRegisterLock.locked_by_name}
                            {studentRegisterLock.locked_at
                              ? ` on ${new Date(studentRegisterLock.locked_at).toLocaleString()}`
                              : ''}
                            .
                          </>
                        ) : null}
                      </p>
                    )}
                  </div>
                )}

                <div className="shrink-0 px-2 sm:px-3 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white shrink-0">
                    {isStudentAttendanceEditable ? 'Mark' : 'View'} · {students.length} students
                  </p>
                  {canEditStudentRegister && (
                    <div className="flex flex-wrap items-center gap-1 ml-auto">
                      {isStudentAttendanceEditable ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBulkStudentAction('Present')}
                            className="attendance-action-btn attendance-action-btn--present"
                          >
                            All P
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBulkStudentAction('Absent')}
                            className="attendance-action-btn attendance-action-btn--absent"
                          >
                            All A
                          </button>
                          {hasSavedStudentAttendance && (
                            <button
                              type="button"
                              onClick={handleCancelStudentAttendanceEdit}
                              className="attendance-action-btn"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => markStudentAttendance.mutate()}
                            disabled={markStudentAttendance.isLoading}
                            className="attendance-action-btn attendance-action-btn--primary disabled:opacity-50"
                          >
                            {markStudentAttendance.isLoading ? 'Saving…' : 'Save'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStudentAttendanceEditing(true)}
                          className="attendance-action-btn attendance-action-btn--primary"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="attendance-table-scroll flex-1 min-h-0 overflow-x-hidden">
                  <table className="data-table data-table-fit attendance-student-table w-full">
                    <colgroup>
                      <col className="attendance-col-roll" />
                      <col className="attendance-col-name" />
                      <col className="attendance-col-admission" />
                      <col className="attendance-col-status" />
                      <col className="attendance-col-remarks" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="attendance-col-roll">Roll</th>
                        <th className="attendance-col-name">Name</th>
                        <th className="attendance-col-admission">Adm#</th>
                        <th className="attendance-col-status">Status</th>
                        <th className="attendance-col-remarks">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {students.map((student: any) => (
                        <tr key={student.id} className="attendance-student-row hover:bg-white/[0.04]">
                          <td className="attendance-col-roll max-w-0">
                            <span className="attendance-cell-text tabular-nums">{student.roll_number || '—'}</span>
                          </td>
                          <td className="attendance-col-name max-w-0">
                            <span
                              className="attendance-cell-text font-medium"
                              title={`${student.first_name} ${student.last_name}`}
                            >
                              {student.first_name} {student.last_name}
                            </span>
                          </td>
                          <td className="attendance-col-admission max-w-0">
                            <span
                              className="attendance-cell-text font-mono text-[10px] text-white/80"
                              title={student.admission_number}
                            >
                              {formatAdmissionDisplay(student.admission_number) || '—'}
                            </span>
                          </td>
                          <td className="attendance-col-status">
                            {isStudentAttendanceEditable ? (
                              <StudentAttendanceStatusPicker
                                value={studentAttendance[student.id]?.status || 'Present'}
                                onChange={(status) => handleStudentStatusChange(student.id, status)}
                              />
                            ) : (
                              <StudentStatusBadge status={studentAttendance[student.id]?.status || 'Present'} />
                            )}
                          </td>
                          <td className="attendance-col-remarks max-w-0">
                            {studentAttendanceNeedsRemarks(
                              studentAttendance[student.id]?.status || 'Present'
                            ) ? (
                              isStudentAttendanceEditable ? (
                                <input
                                  type="text"
                                  value={studentAttendance[student.id]?.remarks || ''}
                                  onChange={(e) =>
                                    handleStudentRemarksChange(student.id, e.target.value)
                                  }
                                  placeholder="Reason"
                                  required
                                  className="input-field text-[10px] py-1 px-1.5 w-full min-w-0"
                                />
                              ) : (
                                <span className="attendance-cell-text text-[10px] text-white/80">
                                  {studentAttendance[student.id]?.remarks || '—'}
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-white/35">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {studentFilters.class_id && (!students || students.length === 0) && (
              <div className="flex-1 flex items-center justify-center text-white/55 text-xs py-8">
                No students found for the selected class/section.
              </div>
            )}

            {!studentFilters.class_id && (
              <div className="flex-1 flex items-center justify-center text-white/55 text-xs py-8">
                Please select a class to mark attendance.
              </div>
            )}
          </div>
        )}

        {/* Teacher Attendance Tab */}
        {activeTab === 'teachers' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-2">
            {canManageTeacherAttendance && (pendingShiftAdjustments?.length ?? 0) > 0 && (
              <div className="glass-card p-3 shrink-0 border border-amber-400/30 bg-amber-500/10">
                <h3 className="text-sm font-semibold text-amber-100 mb-2">
                  Pending shift adjustments ({pendingShiftAdjustments?.length})
                </h3>
                <ul className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {pendingShiftAdjustments?.map((req) => (
                    <li
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/25 bg-black/20 px-2.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-white/90">
                          {req.staff_name}
                          <span className="text-white/50 font-normal">
                            {' '}
                            · {formatShiftListDate(req.attendance_date)}
                          </span>
                        </p>
                        <p className="text-white/70">
                          {adjustmentTypeLabel(req.adjustment_type)}:{' '}
                          {req.current_time ? `${req.current_time} → ` : ''}
                          <strong>{req.requested_time}</strong>
                        </p>
                        <p className="text-white/50 truncate">{req.reason}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openAdminReview(req, 'approve')}
                          className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 text-xs"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdminReview(req, 'reject')}
                          className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isOwnStaffAttendanceView && !teacherId && !dutyLoading && (
              <div className="alert-info py-2 shrink-0">
                <p className="text-sm">
                  Your teacher profile is not linked to this login. Contact School Admin to view your
                  attendance logs.
                </p>
              </div>
            )}

            {faceSummaryError && (
              <div className="glass-card p-4 shrink-0 border border-red-400/30 bg-red-500/10">
                <p className="text-sm text-red-100">
                  {(faceSummaryError as any)?.response?.data?.error ||
                    'Could not load face attendance logs. Select a valid academic year in the sidebar and restart the backend server.'}
                </p>
              </div>
            )}

            {faceSummaryLoading && (
              <div className="glass-card p-6 text-center text-white/60 text-sm shrink-0">
                Loading face attendance logs...
              </div>
            )}

            {!faceSummaryLoading && teacherStaffList.length > 0 && (
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-b border-white/10">
                <p className="text-[11px] font-semibold text-white/90 min-w-0">
                  {isOwnStaffAttendanceView ? 'My attendance' : `Staff · ${teacherStaffList.length}`}
                </p>
                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {!isOwnStaffAttendanceView && faceDailySummary?.totals && (
                    <>
                      <span className="attendance-stat-chip attendance-stat-chip--ok">
                        {faceDailySummary.totals.on_time_count ?? 0} on time
                      </span>
                      <span className="attendance-stat-chip attendance-stat-chip--late">
                        {faceDailySummary.totals.late_count ?? 0} late
                      </span>
                    </>
                  )}
                  {canManageTeacherAttendance && !isOwnStaffAttendanceView && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBulkTeacherAction('Present')}
                        className="attendance-action-btn attendance-action-btn--present"
                      >
                        All P
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkTeacherAction('Absent')}
                        className="attendance-action-btn attendance-action-btn--absent"
                      >
                        All A
                      </button>
                      <button
                        type="button"
                        onClick={() => markTeacherAttendance.mutate()}
                        disabled={markTeacherAttendance.isLoading}
                        className="attendance-action-btn attendance-action-btn--primary disabled:opacity-50"
                      >
                        {markTeacherAttendance.isLoading ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {!faceSummaryLoading && teacherStaffList.length > 0 && (
              <div className="attendance-teachers-scroll flex-1 min-h-0">
                <div
                  className={
                    isOwnStaffAttendanceView
                      ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-3 items-start pb-2'
                      : 'grid grid-cols-1 xl:grid-cols-2 gap-3 pb-2'
                  }
                >
                  <div className={isOwnStaffAttendanceView ? 'space-y-3' : 'contents'}>
                  {teacherStaffList.map((staff) => {
                    const staffId = staff.staff_id
                    const history = getStaffHistory(staff)
                    const statusLabel =
                      logoutStatusLabel(staff.logout_status) ||
                      (staff.logout_missing_date ? 'Logout missing' : null)
                    const missingDate = staff.logout_missing_date
                    const att = teacherAttendance[staffId]
                    const statusLocked = !!staff.auto_absent && !canManageTeacherAttendance
                    return (
                    <div
                      key={staffId}
                      className="glass-card p-3 border border-white/15 flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white/90">
                            {staff.staff_name}
                          </h3>
                          <p className="text-xs text-white/50">
                            {staff.employee_id ? `ID: ${staff.employee_id}` : `Staff #${staff.staff_id}`}
                          </p>
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-blue-200">
                              Total login time:{' '}
                              {staff.total_work_time_display ||
                                `${staff.total_work_minutes ?? 0} minutes`}
                              {staff.is_session_open ? ' (still logged in)' : ''}
                            </p>
                            {staff.punctuality_label && (
                              <p
                                className={`text-xs ${
                                  staff.punctuality_status === 'late'
                                    ? 'text-red-300'
                                    : staff.punctuality_status === 'on_time'
                                      ? 'text-green-300'
                                      : 'text-white/50'
                                }`}
                              >
                                {staff.punctuality_label}
                              </p>
                            )}
                            {staff.auto_absent && (
                              <p className="text-xs text-amber-200">
                                Auto Absent — no login recorded
                                {!canManageTeacherAttendance ? '. Only users with teacher attendance permission can change status.' : '.'}
                              </p>
                            )}
                          </div>
                        </div>
                        {statusLabel && (
                          <div className="flex flex-col items-end text-xs shrink-0">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                staff.logout_status === 'logout_missing' || staff.logout_missing_date
                                  ? 'bg-red-600/50 text-red-100'
                                  : 'bg-blue-600/40 text-blue-100'
                              }`}
                            >
                              {statusLabel}
                              {missingDate && missingDate !== teacherFilters.attendance_date
                                ? ` (${missingDate})`
                                : ''}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mb-3 pb-3 border-b border-white/10 space-y-2">
                        <label className="label-text text-[10px]">Day status</label>
                        {isOwnStaffAttendanceView ? (
                          <p className="text-sm font-medium text-white/90">
                            {att?.status || staff.daily_status || (staff.auto_absent ? 'Absent' : 'Present')}
                          </p>
                        ) : (
                          <>
                            <TeacherAttendanceStatusPicker
                              value={att?.status || (staff.auto_absent ? 'Absent' : 'Present')}
                              onChange={(status) => handleTeacherStatusChange(staffId, status)}
                              disabled={statusLocked}
                            />
                            <input
                              type="text"
                              value={att?.remarks || ''}
                              onChange={(e) => handleTeacherRemarksChange(staffId, e.target.value)}
                              disabled={statusLocked}
                              placeholder="Remarks (optional)"
                              className="input-field text-xs py-1.5 disabled:opacity-50"
                            />
                          </>
                        )}
                        {isOwnStaffAttendanceView && (att?.remarks || staff.daily_remarks) && (
                          <p className="text-xs text-slate-500">
                            Remarks: {(att?.remarks || staff.daily_remarks || '').replace(/\s*\|.*$/, '').trim()}
                          </p>
                        )}
                        {isOwnStaffAttendanceView && (
                          <div className="pt-2 space-y-2 border-t border-slate-100">
                            <p className="text-[10px] text-slate-500">
                              Request a correction — an authorized reviewer will approve or reject.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {(['check_in', 'check_out'] as const).map((adjType) => {
                                const existing = selectedDayAdjustments[adjType]
                                const currentTime =
                                  adjType === 'check_in'
                                    ? staff.daily_check_in_time ||
                                      selectedDayShift?.check_in_time ||
                                      null
                                    : staff.daily_check_out_time ||
                                      selectedDayShift?.check_out_time ||
                                      null
                                const hasPending = existing?.status === 'Pending'
                                return (
                                  <button
                                    key={adjType}
                                    type="button"
                                    disabled={hasPending}
                                    onClick={() =>
                                      openAdjustmentRequest(
                                        teacherFilters.attendance_date,
                                        adjType,
                                        currentTime
                                      )
                                    }
                                    className="px-2 py-1 text-[10px] font-medium rounded-md border border-primary-300 text-primary-800 bg-primary-50 hover:bg-primary-100 disabled:opacity-50"
                                  >
                                    {hasPending
                                      ? `${adjustmentTypeLabel(adjType)} pending`
                                      : `Request ${adjustmentTypeLabel(adjType)}`}
                                  </button>
                                )
                              })}
                            </div>
                            {Object.values(selectedDayAdjustments).length > 0 && (
                              <ul className="space-y-1">
                                {Object.values(selectedDayAdjustments).map((adj) =>
                                  adj ? (
                                    <li
                                      key={adj.id}
                                      className={`text-[10px] px-2 py-1 rounded border ${adjustmentStatusClass(adj.status)}`}
                                    >
                                      {adjustmentTypeLabel(adj.adjustment_type)}: {adj.status}
                                      {adj.status === 'Approved' && adj.approved_time
                                        ? ` → ${adj.approved_time}`
                                        : ` · asked ${adj.requested_time}`}
                                      {adj.review_remarks ? ` — ${adj.review_remarks}` : ''}
                                    </li>
                                  ) : null
                                )}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 border-t border-white/10 pt-3">
                        <p className="text-xs font-medium text-white/60 mb-2">Login / logout history</p>
                        {history.length === 0 ? (
                          <p className="text-xs text-white/40 italic">
                            No face capture for this date.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {history.map((row, index) => {
                              const isPending = row.kind === 'pending_logout'
                              const isLogin = row.kind === 'event' && row.event_type === 'check_in'
                              return (
                                <li
                                  key={row.id}
                                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs border ${
                                    isPending
                                      ? 'bg-red-500/15 border-red-400/30'
                                      : isLogin
                                        ? 'bg-green-500/15 border-green-400/25'
                                        : 'bg-amber-500/15 border-amber-400/25'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        isPending
                                          ? 'bg-red-600 text-white'
                                          : isLogin
                                            ? 'bg-green-600 text-white'
                                            : 'bg-amber-600 text-white'
                                      }`}
                                    >
                                      {index + 1}
                                    </span>
                                    <div>
                                      <span className="font-medium text-white/90 block">
                                        {isPending
                                          ? 'Logout pending'
                                          : row.event_type === 'check_in'
                                            ? 'Login'
                                            : 'Logout'}
                                      </span>
                                      {isPending ? (
                                        <span className="text-[10px] text-red-200">
                                          Forgot to log out — add logout time
                                        </span>
                                      ) : (
                                        <span className="text-white/50 tabular-nums text-[10px]">
                                          {formatEventTime(row.event_time)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {canManageTeacherAttendance && (
                                    <button
                                      type="button"
                                      onClick={() => openHistoryEdit(staff, row)}
                                      className="shrink-0 px-2 py-1 rounded bg-white/15 text-white/90 hover:bg-white/25 text-[10px] font-medium"
                                    >
                                      {isPending ? 'Add logout' : 'Edit'}
                                    </button>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                    )
                  })}
                  </div>

                  {isOwnStaffAttendanceView && (
                    <div className="glass-card flex flex-col border border-slate-200/80 min-h-[22rem] lg:min-h-[28rem] lg:max-h-[calc(100vh-12rem)]">
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-slate-200 shrink-0">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-slate-900">Shift history</h3>
                          <p className="text-[10px] text-slate-500 truncate">
                            All dates · shift {myShiftHistory?.expected_shift_start || '09:00'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => changeShiftHistoryMonth(-1)}
                            className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                            aria-label="Previous month"
                          >
                            ‹
                          </button>
                          <span className="text-xs font-medium text-slate-800 min-w-[7.5rem] text-center">
                            {myShiftHistory?.month_label ||
                              new Date(
                                shiftHistoryMonth.year,
                                shiftHistoryMonth.month - 1,
                                1
                              ).toLocaleString('default', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={() => changeShiftHistoryMonth(1)}
                            className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                            aria-label="Next month"
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-2 min-h-0 max-h-[28rem] lg:max-h-none">
                        {shiftHistoryLoading && (
                          <p className="text-xs text-slate-500 text-center py-8">Loading shift history…</p>
                        )}
                        {!shiftHistoryLoading &&
                          myShiftHistory?.days?.map((day) => {
                            const isSelected =
                              day.attendance_date === teacherFilters.attendance_date
                            return (
                              <button
                                key={day.attendance_date}
                                type="button"
                                onClick={() => {
                                  if (day.is_future) return
                                  setTeacherFilters((prev) => ({
                                    ...prev,
                                    attendance_date: day.attendance_date,
                                  }))
                                  setTeacherAttendance({})
                                }}
                                disabled={day.is_future}
                                className={`w-full text-left mb-1.5 last:mb-0 rounded-lg border px-2.5 py-2 transition-colors ${
                                  isSelected
                                    ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                                    : day.is_future
                                      ? 'border-slate-100 bg-slate-50/50 opacity-60 cursor-default'
                                      : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-800">
                                      {formatShiftListDate(day.attendance_date)}
                                    </p>
                                    <p className="text-[10px] text-slate-500 tabular-nums">
                                      {day.is_future
                                        ? 'Upcoming'
                                        : day.check_in_time || day.check_out_time
                                          ? `In ${day.check_in_time || '—'} · Out ${day.check_out_time || '—'}`
                                          : 'No login / logout'}
                                    </p>
                                  </div>
                                  <span
                                    className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${shiftStatusBadgeClass(day.status)}`}
                                  >
                                    {day.status}
                                  </span>
                                </div>
                                {!day.is_future && (
                                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
                                    <span>
                                      Work:{' '}
                                      <strong className="font-medium text-slate-800">
                                        {day.total_work_hours_label || '0m'}
                                      </strong>
                                      {day.is_session_open ? ' (open)' : ''}
                                    </span>
                                    {day.login_count > 0 && (
                                      <span>
                                        Logins: <strong>{day.login_count}</strong>
                                      </span>
                                    )}
                                    {day.punctuality_label && (
                                      <span className="truncate">{day.punctuality_label}</span>
                                    )}
                                  </div>
                                )}
                                {!day.is_future &&
                                  (day.adjustments?.check_in || day.adjustments?.check_out) && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {(['check_in', 'check_out'] as const).map((t) => {
                                        const adj = day.adjustments?.[t]
                                        if (!adj) return null
                                        return (
                                          <span
                                            key={adj.id}
                                            className={`px-1 py-0.5 rounded text-[9px] border ${adjustmentStatusClass(adj.status)}`}
                                          >
                                            {adjustmentTypeLabel(t)}: {adj.status}
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                              </button>
                            )
                          })}
                        {!shiftHistoryLoading &&
                          (!myShiftHistory?.days || myShiftHistory.days.length === 0) && (
                            <p className="text-xs text-slate-500 text-center py-8">
                              No shift records for this month.
                            </p>
                          )}
                      </div>

                      <p className="text-[10px] text-slate-400 px-3 py-2 border-t border-slate-100 shrink-0">
                        Tap a date to view that day&apos;s check-in / check-out on the left.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!faceSummaryLoading && teacherStaffList.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-white/55 text-xs py-8">
                {isOwnStaffAttendanceView
                  ? 'No login or logout recorded for this date.'
                  : 'No teachers found for this school.'}
              </div>
            )}
          </div>
        )}
        </div>

        {adjustmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="glass-card p-4 w-full max-w-md border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                Request {adjustmentTypeLabel(adjustmentModal.adjustment_type)} adjustment
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                {formatShiftListDate(adjustmentModal.attendance_date)}
                {adjustmentModal.current_time
                  ? ` · Current: ${adjustmentModal.current_time}`
                  : ' · No time recorded yet'}
              </p>
              <label className="text-[10px] text-slate-500 block mb-1">
                Requested {adjustmentTypeLabel(adjustmentModal.adjustment_type)} time
              </label>
              <input
                type="time"
                value={adjustmentForm.requested_time}
                onChange={(e) =>
                  setAdjustmentForm((prev) => ({ ...prev, requested_time: e.target.value }))
                }
                className="w-full px-3 py-2 input-field text-sm mb-3"
                required
              />
              <label className="text-[10px] text-slate-500 block mb-1">Reason (required)</label>
              <textarea
                value={adjustmentForm.reason}
                onChange={(e) =>
                  setAdjustmentForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                rows={3}
                placeholder="Explain why this time should be corrected"
                className="w-full px-3 py-2 input-field text-sm mb-4 resize-none"
                required
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentModal(null)
                    setAdjustmentForm({ requested_time: '', reason: '' })
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submitShiftAdjustment.mutate()}
                  disabled={
                    submitShiftAdjustment.isLoading ||
                    !adjustmentForm.requested_time ||
                    adjustmentForm.reason.trim().length < 3
                  }
                  className="flex-1 px-3 py-2 text-xs rounded-md bg-primary-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitShiftAdjustment.isLoading ? 'Submitting...' : 'Submit request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {adminReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="glass-card p-4 w-full max-w-md border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                {adminReviewModal.mode === 'approve' ? 'Approve' : 'Reject'} shift adjustment
              </h3>
              <p className="text-xs text-slate-600 mb-2">
                {adminReviewModal.request.staff_name} ·{' '}
                {formatShiftListDate(adminReviewModal.request.attendance_date)} ·{' '}
                {adjustmentTypeLabel(adminReviewModal.request.adjustment_type)}
              </p>
              <p className="text-xs text-slate-500 mb-3 bg-slate-50 rounded p-2">
                Requested: {adminReviewModal.request.requested_time}
                {adminReviewModal.request.current_time
                  ? ` (was ${adminReviewModal.request.current_time})`
                  : ''}
                <br />
                Reason: {adminReviewModal.request.reason}
              </p>
              {adminReviewModal.mode === 'approve' && (
                <>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    Approved time (edit if needed)
                  </label>
                  <input
                    type="time"
                    value={adminReviewForm.approved_time}
                    onChange={(e) =>
                      setAdminReviewForm((prev) => ({
                        ...prev,
                        approved_time: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 input-field text-sm mb-3"
                  />
                </>
              )}
              <label className="text-[10px] text-slate-500 block mb-1">
                {adminReviewModal.mode === 'approve' ? 'Remarks (optional)' : 'Rejection reason'}
              </label>
              <textarea
                value={adminReviewForm.review_remarks}
                onChange={(e) =>
                  setAdminReviewForm((prev) => ({
                    ...prev,
                    review_remarks: e.target.value,
                  }))
                }
                rows={2}
                className="w-full px-3 py-2 input-field text-sm mb-4 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdminReviewModal(null)}
                  className="flex-1 px-3 py-2 text-xs rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (adminReviewModal.mode === 'approve') {
                      approveShiftAdjustment.mutate({
                        id: adminReviewModal.request.id,
                        approved_time: adminReviewForm.approved_time,
                        review_remarks: adminReviewForm.review_remarks,
                      })
                    } else {
                      rejectShiftAdjustment.mutate({
                        id: adminReviewModal.request.id,
                        review_remarks: adminReviewForm.review_remarks,
                      })
                    }
                  }}
                  disabled={
                    approveShiftAdjustment.isLoading ||
                    rejectShiftAdjustment.isLoading ||
                    (adminReviewModal.mode === 'approve' && !adminReviewForm.approved_time)
                  }
                  className={`flex-1 px-3 py-2 text-xs rounded-md text-white disabled:opacity-50 ${
                    adminReviewModal.mode === 'approve'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {approveShiftAdjustment.isLoading || rejectShiftAdjustment.isLoading
                    ? 'Saving...'
                    : adminReviewModal.mode === 'approve'
                      ? 'Approve & update shift'
                      : 'Reject request'}
                </button>
              </div>
            </div>
          </div>
        )}

        {historyEdit && canManageTeacherAttendance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="glass-card p-4 w-full max-w-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">
                {historyEdit.row.kind === 'pending_logout'
                  ? 'Add logout time'
                  : 'Edit attempt time'}
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                {historyEdit.staffName}
                {historyEdit.row.kind === 'pending_logout'
                  ? ' — forgot to log out'
                  : ` — ${historyEdit.row.event_type === 'check_in' ? 'Login' : 'Logout'}`}
              </p>
              <label className="text-[10px] text-slate-400 block mb-1">Time</label>
              <input
                type="time"
                value={historyEditTime}
                onChange={(e) => setHistoryEditTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md bg-white text-slate-900 border-slate-300 text-sm mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryEdit(null)}
                  className="flex-1 px-3 py-2 text-xs rounded-md bg-slate-50 text-slate-900 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitHistoryEdit}
                  disabled={
                    patchAttendanceLogMutation.isLoading || addLogoutMutation.isLoading
                  }
                  className="flex-1 px-3 py-2 text-xs rounded-md bg-blue-600 text-slate-900 hover:bg-blue-700 disabled:opacity-50"
                >
                  {patchAttendanceLogMutation.isLoading || addLogoutMutation.isLoading
                    ? 'Saving...'
                    : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
