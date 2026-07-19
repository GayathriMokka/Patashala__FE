'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { formatMoney } from '@/lib/formatMoney'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

type CloneGroupKey =
  | 'classes'
  | 'sections'
  | 'subjects'
  | 'students'
  | 'teacherRoles'
  | 'teacherSubjects'
  | 'feeStructures'
  | 'leaveTypes'
  | 'grades'
  | 'salaryStructures'
  | 'timetable'
  | 'exams'
  | 'expenses'

interface CloneGroupConfig {
  key: CloneGroupKey
  label: string
  description: string
  excluded?: boolean
  warning?: string
}

const CLONE_GROUPS: CloneGroupConfig[] = [
  { key: 'classes', label: 'Classes', description: 'Class definitions (name, code, level)' },
  { key: 'sections', label: 'Sections', description: 'Sections under each class (requires classes)' },
  {
    key: 'subjects',
    label: 'Subjects & Syllabus',
    description: 'Subjects, class assignments, units and lessons',
  },
  {
    key: 'students',
    label: 'Students',
    description: 'Enroll active students into the target year (same class/section mapping)',
  },
  {
    key: 'teacherRoles',
    label: 'Teacher Role Assignments',
    description: 'Class teacher, subject teacher, and other duty roles',
  },
  {
    key: 'teacherSubjects',
    label: 'Teacher-Subject Mapping',
    description: 'Which teacher teaches which subject in which class',
  },
  {
    key: 'feeStructures',
    label: 'Fee Structures',
    description: 'Fee templates and installments only — payment records are never cloned',
    warning: 'Fee payments are excluded',
  },
  {
    key: 'leaveTypes',
    label: 'Leave Types',
    description: 'Leave type master configuration for the year',
  },
  { key: 'grades', label: 'Grade Bands', description: 'Grading scale (A, B, C thresholds)' },
  {
    key: 'salaryStructures',
    label: 'Salary Structures',
    description: 'Staff salary templates — payroll history is never cloned',
    warning: 'Salary payments are excluded',
  },
  { key: 'timetable', label: 'Timetable', description: 'Weekly period schedule' },
  {
    key: 'exams',
    label: 'Exam Definitions',
    description: 'Exam setup and subjects — marks and results are never cloned',
    warning: 'Marks & results excluded',
  },
  {
    key: 'expenses',
    label: 'Expenditure Records',
    description: 'Optional — select expense categories to copy (off by default)',
    warning: 'Revenue & fee payments are always excluded',
  },
]

const EXCLUDED_ALWAYS = [
  'Revenue transactions, refunds & adjustments',
  'Fee payment records & receipts',
  'Salary payment history & payslips',
  'Attendance records (student & staff)',
  'Marks, results & report cards',
  'Leave requests & approvals',
]

function SelectableList<T extends { id: number | string }>({
  items,
  selected,
  onChange,
  renderItem,
  searchPlaceholder = 'Search...',
  getSearchText,
}: {
  items: T[]
  selected: Set<number>
  onChange: (selected: Set<number>) => void
  renderItem: (item: T) => React.ReactNode
  searchPlaceholder?: string
  getSearchText: (item: T) => string
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((item) => getSearchText(item).toLowerCase().includes(q))
  }, [items, search, getSearchText])

  const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(Number(item.id)))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
        />
        <button
          type="button"
          onClick={() => {
            const next = new Set(selected)
            if (allSelected) {
              filtered.forEach((item) => next.delete(Number(item.id)))
            } else {
              filtered.forEach((item) => next.add(Number(item.id)))
            }
            onChange(next)
          }}
          className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {selected.size} / {items.length} selected
        </span>
      </div>
      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 p-3 text-center">No items found</p>
        ) : (
          filtered.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(Number(item.id))}
                onChange={(e) => {
                  const next = new Set(selected)
                  if (e.target.checked) next.add(Number(item.id))
                  else next.delete(Number(item.id))
                  onChange(next)
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">{renderItem(item)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}

function CloneAcademicYearPageInner() {
  const { user, token } = useAuth()
  const { academicYears, loadAcademicYears } = useAcademicYear()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAccess, accessLoading } = useRequirePageAccess('/master-data')

  const initialSourceId = searchParams.get('sourceYearId') || ''
  const initialSchoolId = searchParams.get('schoolId') || ''

  const [step, setStep] = useState(1)
  const [sourceYearId, setSourceYearId] = useState(initialSourceId)
  const [targetYearId, setTargetYearId] = useState('')
  const [schoolId, setSchoolId] = useState<number | null>(
    user?.role_name === 'Super Admin' && initialSchoolId
      ? Number(initialSchoolId)
      : user?.school_id ?? null
  )

  const [enabledGroups, setEnabledGroups] = useState<Set<CloneGroupKey>>(
    new Set(['classes', 'sections', 'subjects', 'leaveTypes', 'grades', 'feeStructures'])
  )

  const [selectedClassIds, setSelectedClassIds] = useState<Set<number>>(new Set())
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<number>>(new Set())
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(new Set())
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set())
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<number>>(new Set())
  const [selectedFeeStructureIds, setSelectedFeeStructureIds] = useState<Set<number>>(new Set())
  const [selectedLeaveTypeIds, setSelectedLeaveTypeIds] = useState<Set<number>>(new Set())
  const [selectedGradeIds, setSelectedGradeIds] = useState<Set<number>>(new Set())
  const [selectedSalaryStructureIds, setSelectedSalaryStructureIds] = useState<Set<number>>(new Set())
  const [selectedExamIds, setSelectedExamIds] = useState<Set<number>>(new Set())
  const [selectedExpenseCategories, setSelectedExpenseCategories] = useState<Set<string>>(new Set())
  const [cloneResult, setCloneResult] = useState<Record<string, number> | null>(null)

  const { data: schools } = useQuery(
    ['schools'],
    async () => {
      const res = await axios.get(`${API_URL}/schools`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    { enabled: !!token && user?.role_name === 'Super Admin' }
  )

  const effectiveSchoolId =
    user?.role_name === 'Super Admin' ? schoolId : user?.school_id

  const { data: yearList } = useQuery(
    ['academic-years-clone', effectiveSchoolId],
    async () => {
      const res = await axios.get(`${API_URL}/academic-years`, {
        params: { school_id: effectiveSchoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data || []
    },
    { enabled: !!token && !!effectiveSchoolId }
  )

  const years = yearList || academicYears || []

  const { data: preview, isLoading: previewLoading } = useQuery(
    ['clone-preview', sourceYearId, effectiveSchoolId],
    async () => {
      const res = await axios.get(`${API_URL}/academic-years/${sourceYearId}/clone-preview`, {
        params: { school_id: effectiveSchoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    {
      enabled: !!token && !!sourceYearId && !!effectiveSchoolId && step >= 2,
      onSuccess: (data) => {
        if (selectedClassIds.size === 0 && data.classes?.length) {
          setSelectedClassIds(new Set(data.classes.map((c: { id: number }) => c.id)))
        }
        if (selectedSectionIds.size === 0 && data.sections?.length) {
          setSelectedSectionIds(new Set(data.sections.map((s: { id: number }) => s.id)))
        }
        if (selectedSubjectIds.size === 0 && data.subjects?.length) {
          setSelectedSubjectIds(new Set(data.subjects.map((s: { id: number }) => s.id)))
        }
        if (selectedStudentIds.size === 0 && data.students?.length) {
          setSelectedStudentIds(new Set(data.students.map((s: { id: number }) => s.id)))
        }
        if (selectedFeeStructureIds.size === 0 && data.feeStructures?.length) {
          setSelectedFeeStructureIds(new Set(data.feeStructures.map((f: { id: number }) => f.id)))
        }
        if (selectedLeaveTypeIds.size === 0 && data.leaveTypes?.length) {
          setSelectedLeaveTypeIds(new Set(data.leaveTypes.map((l: { id: number }) => l.id)))
        }
        if (selectedGradeIds.size === 0 && data.grades?.length) {
          setSelectedGradeIds(new Set(data.grades.map((g: { id: number }) => g.id)))
        }
        if (selectedSalaryStructureIds.size === 0 && data.salaryStructures?.length) {
          setSelectedSalaryStructureIds(new Set(data.salaryStructures.map((s: { id: number }) => s.id)))
        }
        if (selectedExamIds.size === 0 && data.exams?.length) {
          setSelectedExamIds(new Set(data.exams.map((e: { id: number }) => e.id)))
        }
      },
    }
  )

  const cloneMutation = useMutation(
    async () => {
      const options: Record<string, unknown> = {}

      const setGroup = (key: CloneGroupKey, selectedIds?: number[] | string[], extra?: Record<string, unknown>) => {
        options[key] = {
          enabled: enabledGroups.has(key),
          ...(selectedIds !== undefined ? { selectedIds } : {}),
          ...extra,
        }
      }

      setGroup('classes', Array.from(selectedClassIds))
      setGroup('sections', Array.from(selectedSectionIds))
      setGroup('subjects', Array.from(selectedSubjectIds))
      setGroup('students', undefined, { selectedStudentIds: Array.from(selectedStudentIds) })
      setGroup('teacherRoles', undefined, { selectedTeacherIds: Array.from(selectedTeacherIds) })
      setGroup('teacherSubjects', undefined, { selectedTeacherIds: Array.from(selectedTeacherIds) })
      setGroup('feeStructures', Array.from(selectedFeeStructureIds))
      setGroup('leaveTypes', Array.from(selectedLeaveTypeIds))
      setGroup('grades', Array.from(selectedGradeIds))
      setGroup('salaryStructures', Array.from(selectedSalaryStructureIds), {
        selectedStaffIds: preview?.salaryStructures
          ?.filter((s: { id: number }) => selectedSalaryStructureIds.has(s.id))
          .map((s: { staff_id: number }) => s.staff_id),
      })
      setGroup('timetable')
      setGroup('exams', Array.from(selectedExamIds))
      setGroup('expenses', undefined, { selectedCategories: Array.from(selectedExpenseCategories) })

      const res = await axios.post(
        `${API_URL}/academic-years/${sourceYearId}/clone`,
        {
          target_academic_year_id: Number(targetYearId),
          school_id: effectiveSchoolId,
          options,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data
    },
    {
      onSuccess: (data) => {
        setCloneResult(data.data?.stats || {})
        setStep(4)
        loadAcademicYears()
      },
      onError: (error: unknown) => {
        const err = error as { response?: { data?: { error?: string } } }
        alert(err.response?.data?.error || 'Clone failed. Please try again.')
      },
    }
  )

  const toggleGroup = useCallback((key: CloneGroupKey) => {
    setEnabledGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectAllGroups = () => setEnabledGroups(new Set(CLONE_GROUPS.map((g) => g.key)))
  const deselectAllGroups = () => setEnabledGroups(new Set())

  const sourceYear = years.find((y: { id: number | string }) => String(y.id) === String(sourceYearId))
  const targetYear = years.find((y: { id: number | string }) => String(y.id) === String(targetYearId))

  const canProceedStep1 = sourceYearId && targetYearId && sourceYearId !== targetYearId
  const canProceedStep2 = enabledGroups.size > 0

  if (accessLoading || !user || !canAccess) return null

  const steps = [
    { num: 1, label: 'Select Years' },
    { num: 2, label: 'Choose Data' },
    { num: 3, label: 'Review' },
    { num: 4, label: 'Complete' },
  ]

  return (
    <Layout>
      <div className="page-container max-w-4xl">
        {/* Header */}
        <div>
          <Link
            href="/master-data"
            className="text-sm text-blue-600 hover:text-blue-700 mb-2 inline-flex items-center gap-1"
          >
            ← Back to Master Data
          </Link>
          <h1 className="page-title">Clone Academic Year Data</h1>
          <p className="page-subtitle">
            Copy structure and configuration from one academic year to another. Financial transactions are excluded by default.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                  step >= s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-xs font-medium ${step >= s.num ? 'text-slate-900' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${step > s.num ? 'bg-emerald-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Excluded notice */}
        <div className="glass-card p-4 border-l-4 border-amber-400">
          <p className="text-sm font-medium text-amber-900 mb-1">Always excluded from clone</p>
          <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
            {EXCLUDED_ALWAYS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Step 1: Select years */}
        {step === 1 && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Step 1 — Select Source & Target Years</h2>

            {user.role_name === 'Super Admin' && (
              <div>
                <label className="label-text">School</label>
                <SelectField
                  value={schoolId || ''}
                  onChange={(e) => {
                    setSchoolId(e.target.value ? Number(e.target.value) : null)
                    setSourceYearId('')
                    setTargetYearId('')
                  }}
                  className="select-field max-w-md"
                >
                  <option value="">Select school</option>
                  {schools?.map((s: { id: number; name: string; code: string }) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-text">
                  Source Year <span className="text-red-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">(copy from)</span>
                </label>
                <SelectField
                  value={sourceYearId}
                  onChange={(e) => setSourceYearId(e.target.value)}
                  className="select-field"
                  disabled={!effectiveSchoolId}
                >
                  <option value="">Select source year</option>
                  {years.map((y: { id: number; name: string; start_date: string }) => (
                    <option key={y.id} value={y.id}>
                      {y.name} ({new Date(y.start_date).getFullYear()})
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <label className="label-text">
                  Target Year <span className="text-red-500">*</span>
                  <span className="text-slate-400 font-normal ml-1">(copy to)</span>
                </label>
                <SelectField
                  value={targetYearId}
                  onChange={(e) => setTargetYearId(e.target.value)}
                  className="select-field"
                  disabled={!effectiveSchoolId}
                >
                  <option value="">Select target year</option>
                  {years
                    .filter((y: { id: number }) => String(y.id) !== String(sourceYearId))
                    .map((y: { id: number; name: string; start_date: string; is_locked: boolean }) => (
                      <option key={y.id} value={y.id} disabled={y.is_locked}>
                        {y.name} ({new Date(y.start_date).getFullYear()})
                        {y.is_locked ? ' — Locked' : ''}
                      </option>
                    ))}
                </SelectField>
              </div>
            </div>

            {sourceYearId === targetYearId && sourceYearId && (
              <p className="text-sm text-red-600">Source and target years must be different.</p>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                Next: Choose Data →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Choose data groups & individual selections */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="glass-card p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Step 2 — Choose What to Clone</h2>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={selectAllGroups}
                    className="px-3 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllGroups}
                    className="px-3 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CLONE_GROUPS.map((group) => (
                  <label
                    key={group.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      enabledGroups.has(group.key)
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabledGroups.has(group.key)}
                      onChange={() => toggleGroup(group.key)}
                      className="mt-0.5 h-4 w-4 rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{group.label}</p>
                      <p className="text-xs text-slate-500">{group.description}</p>
                      {group.warning && (
                        <p className="text-xs text-amber-700 mt-0.5">⚠ {group.warning}</p>
                      )}
                      {preview?.counts && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {previewLoading
                            ? 'Loading...'
                            : `${preview.counts[group.key === 'teacherRoles' ? 'teachers' : group.key === 'teacherSubjects' ? 'teachers' : group.key === 'leaveTypes' ? 'leaveTypes' : group.key === 'feeStructures' ? 'feeStructures' : group.key === 'salaryStructures' ? 'salaryStructures' : group.key === 'timetable' ? 'timetable' : group.key] ?? 0} items available`}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Individual selections */}
            {previewLoading ? (
              <div className="glass-card p-6 text-center text-slate-500">Loading preview data...</div>
            ) : preview ? (
              <div className="space-y-4">
                {enabledGroups.has('classes') && preview.classes?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Classes</h3>
                    <SelectableList
                      items={preview.classes}
                      selected={selectedClassIds}
                      onChange={setSelectedClassIds}
                      getSearchText={(c) => `${c.name} ${c.code || ''}`}
                      renderItem={(c) => (
                        <span>
                          {c.name} {c.code ? `(${c.code})` : ''} — Level {c.level ?? '—'}
                        </span>
                      )}
                    />
                  </div>
                )}

                {enabledGroups.has('sections') && preview.sections?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Sections</h3>
                    <SelectableList
                      items={preview.sections}
                      selected={selectedSectionIds}
                      onChange={setSelectedSectionIds}
                      getSearchText={(s) => `${s.class_name} ${s.name}`}
                      renderItem={(s) => (
                        <span>
                          {s.class_name} — Section {s.name}
                        </span>
                      )}
                    />
                  </div>
                )}

                {enabledGroups.has('subjects') && preview.subjects?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Subjects</h3>
                    <SelectableList
                      items={preview.subjects}
                      selected={selectedSubjectIds}
                      onChange={setSelectedSubjectIds}
                      getSearchText={(s) => `${s.name} ${s.code || ''}`}
                      renderItem={(s) => (
                        <span>
                          {s.name} {s.code ? `(${s.code})` : ''} — {s.type}
                        </span>
                      )}
                    />
                  </div>
                )}

                {enabledGroups.has('students') && preview.students?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Students</h3>
                    <SelectableList
                      items={preview.students}
                      selected={selectedStudentIds}
                      onChange={setSelectedStudentIds}
                      searchPlaceholder="Search by name or admission no..."
                      getSearchText={(s) =>
                        `${s.first_name} ${s.last_name} ${s.admission_number} ${s.class_name}`
                      }
                      renderItem={(s) => (
                        <span>
                          {s.admission_number} — {s.first_name} {s.last_name} ({s.class_name}-
                          {s.section_name})
                        </span>
                      )}
                    />
                  </div>
                )}

                {(enabledGroups.has('teacherRoles') || enabledGroups.has('teacherSubjects')) &&
                  preview.teachers?.length > 0 && (
                    <div className="glass-card p-4">
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">
                        Forward teachers to new year
                      </h3>
                      <p className="text-xs text-slate-500 mb-2">
                        Only selected teachers will appear in the target academic year. Others stay in the source year only.
                      </p>
                      <SelectableList
                        items={preview.teachers}
                        selected={selectedTeacherIds}
                        onChange={setSelectedTeacherIds}
                        getSearchText={(t) => `${t.name} ${t.email || ''}`}
                        renderItem={(t) => (
                          <span>
                            {t.name} {t.role_count > 0 ? `(${t.role_count} roles)` : ''}
                          </span>
                        )}
                      />
                    </div>
                  )}

                {enabledGroups.has('feeStructures') && preview.feeStructures?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Fee Structures</h3>
                    <SelectableList
                      items={preview.feeStructures}
                      selected={selectedFeeStructureIds}
                      onChange={setSelectedFeeStructureIds}
                      getSearchText={(f) => `${f.name} ${f.class_name}`}
                      renderItem={(f) => (
                        <span>
                          {f.name} — {f.class_name} ({formatMoney(f.total_amount, { compact: true })})
                        </span>
                      )}
                    />
                  </div>
                )}

                {enabledGroups.has('salaryStructures') && preview.salaryStructures?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Salary Structures</h3>
                    <SelectableList
                      items={preview.salaryStructures}
                      selected={selectedSalaryStructureIds}
                      onChange={setSelectedSalaryStructureIds}
                      getSearchText={(s) => s.staff_name}
                      renderItem={(s) => (
                        <span>
                          {s.staff_name} — {formatMoney(s.net_salary, { compact: true })}/mo
                        </span>
                      )}
                    />
                  </div>
                )}

                {enabledGroups.has('exams') && preview.exams?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Select Exams</h3>
                    <SelectableList
                      items={preview.exams}
                      selected={selectedExamIds}
                      onChange={setSelectedExamIds}
                      getSearchText={(e) => `${e.name} ${e.exam_type}`}
                      renderItem={(e) => (
                        <span>
                          {e.name} — {e.exam_type}
                        </span>
                      )}
                    />
                  </div>
                )}

                {enabledGroups.has('expenses') && preview.expenseCategories?.length > 0 && (
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">
                      Select Expenditure Categories to Clone
                    </h3>
                    <p className="text-xs text-slate-500 mb-2">
                      Choose which expense categories to copy. Leave empty to skip all expenditure records.
                    </p>
                    <div className="space-y-2">
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedExpenseCategories(
                              new Set(preview.expenseCategories.map((c: { name: string }) => c.name))
                            )
                          }
                          className="px-3 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
                        >
                          Select All Categories
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedExpenseCategories(new Set())}
                          className="px-3 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50"
                        >
                          Clear
                        </button>
                      </div>
                      {preview.expenseCategories.map((cat: { name: string; count: number }) => (
                        <label
                          key={cat.name}
                          className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedExpenseCategories.has(cat.name)}
                            onChange={(e) => {
                              const next = new Set(selectedExpenseCategories)
                              if (e.target.checked) next.add(cat.name)
                              else next.delete(cat.name)
                              setSelectedExpenseCategories(next)
                            }}
                            className="h-4 w-4 rounded"
                          />
                          <span className="text-sm text-slate-700">
                            {cat.name} ({cat.count} records)
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                Next: Review →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Step 3 — Review & Confirm</h2>

            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Source</p>
                <p className="text-sm font-semibold text-slate-900">{sourceYear?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Target</p>
                <p className="text-sm font-semibold text-slate-900">{targetYear?.name}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Data to be cloned:</p>
              <ul className="space-y-1">
                {CLONE_GROUPS.filter((g) => enabledGroups.has(g.key)).map((g) => {
                  let count = ''
                  if (preview) {
                    if (g.key === 'classes') count = `${selectedClassIds.size} classes`
                    else if (g.key === 'sections') count = `${selectedSectionIds.size} sections`
                    else if (g.key === 'subjects') count = `${selectedSubjectIds.size} subjects`
                    else if (g.key === 'students') count = `${selectedStudentIds.size} students`
                    else if (g.key === 'teacherRoles' || g.key === 'teacherSubjects')
                      count = `${selectedTeacherIds.size} employees`
                    else if (g.key === 'feeStructures') count = `${selectedFeeStructureIds.size} fee structures`
                    else if (g.key === 'salaryStructures')
                      count = `${selectedSalaryStructureIds.size} salary structures`
                    else if (g.key === 'exams') count = `${selectedExamIds.size} exams`
                    else if (g.key === 'expenses')
                      count =
                        selectedExpenseCategories.size > 0
                          ? `${selectedExpenseCategories.size} expense categories`
                          : 'none selected'
                    else if (g.key === 'timetable') count = `${preview.timetableCount || 0} periods`
                    else if (g.key === 'leaveTypes') count = `${selectedLeaveTypeIds.size} leave types`
                    else if (g.key === 'grades') count = `${selectedGradeIds.size} grades`
                  }
                  return (
                    <li key={g.key} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      {g.label}
                      {count && <span className="text-slate-400">({count})</span>}
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                This action will copy the selected data into <strong>{targetYear?.name}</strong>.
                Existing data in the target year will not be deleted, but duplicate enrollments will be skipped.
              </p>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={cloneMutation.isLoading}
                onClick={() => cloneMutation.mutate()}
                className="px-6 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {cloneMutation.isLoading ? 'Cloning...' : 'Confirm & Clone'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 4 && cloneResult && (
          <div className="glass-card p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Clone Complete!</h2>
              <p className="page-subtitle">
                Data has been successfully copied to {targetYear?.name}.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(cloneResult).map(([key, value]) =>
                value > 0 ? (
                  <div key={key} className="p-3 bg-slate-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{value}</p>
                    <p className="text-xs text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                  </div>
                ) : null
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Link
                href="/master-data"
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
              >
                Go to Master Data
              </Link>
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setCloneResult(null)
                  setSourceYearId('')
                  setTargetYearId('')
                }}
                className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Clone Another Year
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

import { Suspense } from 'react'
export default function CloneAcademicYearPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CloneAcademicYearPageInner />
    </Suspense>
  )
}
