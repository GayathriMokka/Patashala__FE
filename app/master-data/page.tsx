'use client'

import FaceRegistrationPanel from '@/components/attendance/FaceRegistrationPanel'
import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useRef, useMemo } from 'react'
import ExportMenu from '@/components/ExportMenu'
import { usePageExport } from '@/lib/usePageExport'
import Link from 'next/link'
import {
  TEACHER_DUTY_ROLES,
  roleNeedsClassSection,
  roleNeedsSubject,
  formatRoleAssignmentLabel,
} from '@/lib/teacherDutyRoles'
import { EMPLOYEE_ID_TOKENS, DEFAULT_EMPLOYEE_ID_FORMAT } from '@/lib/employeeIdTokens'
import { renderEmployeeIdPreview, isValidEmployeeIdTemplate } from '@/lib/employeeIdPreview'
import { ID_FORMAT_TYPES, getIdFormatTypeMeta, type IdFormatType } from '@/lib/idFormatTypes'
import { featuresForRoleTypes } from '@/lib/teacherRoleFeatures'
import BillingInvoiceTab from './BillingInvoiceTab'
import CouponTab from './CouponTab'
import ExpensesMasterTab from './ExpensesMasterTab'
import ExtraPaymentsMasterTab from './ExtraPaymentsMasterTab'
import AssetsMasterTab from './AssetsMasterTab'
import LeaveMasterTab from './LeaveMasterTab'
import ExamTypesMasterTab from './ExamTypesMasterTab'
import BranchManagementTab from './BranchManagementTab'
import TransportMasterTab from '@/components/master-data/TransportMasterTab'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
  MasterDataToolbarLink,
} from '@/components/master-data/MasterDataTabShell'
import { PageFilterField } from '@/components/PageFilters'
import { useBranch } from '@/contexts/BranchContext'
import { buildBranchScopedHeaders } from '@/lib/branchAccess'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import {
  MASTER_DATA_TAB_LABELS,
  MASTER_DATA_TAB_SHORT_LABELS,
  getVisibleMasterDataTabs,
  getGroupedVisibleMasterTabs,
} from '@/lib/masterDataTabs'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { useUrlQueryState } from '@/lib/useUrlQueryState'
import { getApiUrl } from '@/lib/api'

const MASTER_DATA_TABS = [
  'branches',
  'academic-years',
  'classes',
  'sections',
  'subjects',
  'teacher-roles',
  'id',
  'billing',
  'coupon',
  'expenses',
  'assets',
  'ex-payments',
  'leave',
  'exam-types',
  'transport',
  'face-registration',
] as const

type MasterDataTab = (typeof MASTER_DATA_TABS)[number]

export default function MasterDataPage() {
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth()
  const {
    academicYear,
    academicYears,
    loadAcademicYears,
    setAcademicYear,
    isLoading: yearLoading,
  } = useAcademicYear()
  const { branch, isAllBranches } = useBranch()
  const { scopedHeaders, branchScopeKey } = useBranchYearScope()
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(
    user?.role_name === 'Super Admin' ? null : (user?.school_id ?? null)
  )

  const effectiveSchoolId =
    user?.role_name === 'Super Admin' ? selectedSchoolId : user?.school_id

  const numericSchoolId = effectiveSchoolId ? Number(effectiveSchoolId) : null
  const numericAcademicYearId = academicYear?.id ? Number(academicYear.id) : null
  const hasValidSchoolId = Number.isFinite(numericSchoolId) && (numericSchoolId as number) > 0
  const hasValidAcademicYearId =
    Number.isFinite(numericAcademicYearId) && (numericAcademicYearId as number) > 0
  const masterDataReady =
    isAuthenticated &&
    !authLoading &&
    !yearLoading &&
    !!user &&
    !!token &&
    hasValidSchoolId &&
    hasValidAcademicYearId

  const { canAccess, accessLoading } = useRequirePageAccess('/master-data')

  useEffect(() => {
    if (user?.role_name !== 'Super Admin' && user?.school_id) {
      setSelectedSchoolId(user.school_id)
    }
  }, [user?.school_id, user?.role_name])

  const { data: schools } = useQuery(
    ['schools'],
    async () => {
      const response = await axios.get(`${getApiUrl()}/schools`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data
    },
    { enabled: isAuthenticated && !authLoading && !!user && !!token && user.role_name === 'Super Admin' }
  )

  const { data: superAdminAcademicYears } = useQuery(
    ['academic-years', numericSchoolId],
    async () => {
      const response = await axios.get(`${getApiUrl()}/academic-years`, {
        params: { school_id: numericSchoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data || []
    },
    {
      enabled:
        isAuthenticated &&
        !authLoading &&
        !!token &&
        hasValidSchoolId &&
        user?.role_name === 'Super Admin',
    }
  )

  useEffect(() => {
    if (user?.role_name !== 'Super Admin' || !superAdminAcademicYears?.length) return
    const currentAcademicYearId = academicYear?.id ? Number(academicYear.id) : NaN
    const isValid = superAdminAcademicYears.some((y: { id: number | string }) => Number(y.id) === currentAcademicYearId)
    if (!isValid) {
      const active =
        superAdminAcademicYears.find((y: { is_active: boolean }) => y.is_active) ||
        superAdminAcademicYears[0]
      setAcademicYear(active)
    }
  }, [superAdminAcademicYears, user?.role_name, academicYear?.id, setAcademicYear])

  // Fetch classes
  const { data: classes } = useQuery(
    ['classes', numericSchoolId, numericAcademicYearId, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/classes`, {
        params: {
          school_id: numericSchoolId,
          academic_year_id: numericAcademicYearId,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: masterDataReady, retry: false }
  )

  // Fetch subjects
  const { data: subjects } = useQuery(
    ['subjects', numericSchoolId, numericAcademicYearId, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/subjects`, {
        params: {
          school_id: numericSchoolId,
          academic_year_id: numericAcademicYearId,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: masterDataReady, retry: false }
  )

  // Fetch teachers
  const { data: teachers } = useQuery(
    ['teachers', effectiveSchoolId, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/teachers`, {
        params: {
          school_id: effectiveSchoolId,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    {
      enabled:
        isAuthenticated &&
        !authLoading &&
        !!user &&
        !!token &&
        !!effectiveSchoolId &&
        !!academicYear?.id,
    }
  )

  if (accessLoading || !user || !canAccess) {
    return null
  }

  return (
    <Layout>
      <div className="page-container master-data-page">
        {user.role_name === 'Super Admin' && (
          <div className="glass-card p-4 shrink-0">
            <label htmlFor="master-school" className="label-text">
              School <span className="text-red-400">*</span>
            </label>
            <SelectField
              id="master-school"
              value={selectedSchoolId || ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null
                setSelectedSchoolId(id)
              }}
              className="w-full max-w-md px-4 py-2 border border-slate-200 rounded-lg bg-white text-slate-900 border-slate-300"
            >
              <option value="" disabled>
                Select a school
              </option>
              {schools?.map((school: { id: number; name: string; code: string }) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </SelectField>
            {!effectiveSchoolId && (
              <p className="mt-2 text-sm text-amber-800">
                Select a school to load master data for that school.
              </p>
            )}
          </div>
        )}

        {!academicYear?.id && effectiveSchoolId && (
          <div className="glass-card p-4 shrink-0">
            <p className="text-sm text-amber-800">
              Select an academic year from the sidebar to manage master data.
            </p>
          </div>
        )}

        <MasterDataContent
          user={user}
          token={token}
          schoolId={effectiveSchoolId}
          schools={schools}
          academicYear={academicYear}
          academicYears={
            user.role_name === 'Super Admin' ? superAdminAcademicYears || [] : academicYears
          }
          loadAcademicYears={loadAcademicYears}
          classes={classes}
          subjects={subjects}
          teachers={teachers}
          masterDataReady={masterDataReady}
        />
      </div>
    </Layout>
  )
}

// Master Data Content Component
function MasterDataContent({
  user,
  token,
  schoolId,
  schools,
  academicYear,
  academicYears,
  loadAcademicYears,
  classes,
  subjects,
  teachers,
  masterDataReady,
}: any) {
  const queryClient = useQueryClient()
  const { hasFeature, isSuperAdmin, permissionsReady } = useSchoolFeatures()
  const {
    scopedHeaders,
    branchScopeKey,
    branch,
    isAllBranches,
    requireBranchForWrite,
    branchLabel,
  } = useBranchYearScope()
  const canManageBranchScopedData = !isAllBranches && !!branch?.id
  const [masterTab, setMasterTab] = useUrlQueryState(
    'tab',
    MASTER_DATA_TABS as unknown as string[],
    'academic-years'
  ) as [MasterDataTab, (tab: MasterDataTab) => void]

  useEffect(() => {
    if (typeof window === 'undefined') return
    const legacy = new URLSearchParams(window.location.search).get('tab')
    if (legacy === 'vans' || legacy === 'trips') {
      setMasterTab('transport')
    }
  }, [setMasterTab])

  const visibleMasterTabs = useMemo(
    () => getVisibleMasterDataTabs(MASTER_DATA_TABS, hasFeature, isSuperAdmin),
    [hasFeature, isSuperAdmin, permissionsReady]
  )

  const groupedMasterTabs = useMemo(
    () => getGroupedVisibleMasterTabs(visibleMasterTabs),
    [visibleMasterTabs]
  )

  useEffect(() => {
    if (!permissionsReady || visibleMasterTabs.length === 0) return
    if (!visibleMasterTabs.includes(masterTab)) {
      setMasterTab(visibleMasterTabs[0] as MasterDataTab)
    }
  }, [permissionsReady, visibleMasterTabs, masterTab, setMasterTab])

  // Classes state
  const [showClassForm, setShowClassForm] = useState(false)
  const [editingClass, setEditingClass] = useState<any>(null)
  const [classListYearId, setClassListYearId] = useState<string>('')
  const [classFormData, setClassFormData] = useState({
    academic_year_id: '',
    name: '',
    code: '',
    level: '',
    description: '',
  })

  const [showSectionForm, setShowSectionForm] = useState(false)
  const [editingSection, setEditingSection] = useState<any>(null)
  const [sectionListYearId, setSectionListYearId] = useState<string>('')
  const [selectedClassForSection, setSelectedClassForSection] = useState<string>('')
  const [sectionFormData, setSectionFormData] = useState({
    academic_year_id: '',
    class_id: '',
    name: '',
    code: '',
    capacity: '40',
    class_teacher_id: '',
  })

  useEffect(() => {
    if (academicYear?.id) {
      setClassListYearId(String(academicYear.id))
      setSectionListYearId(String(academicYear.id))
    } else if (academicYears?.length) {
      const active = academicYears.find((y: { is_active: boolean }) => y.is_active) || academicYears[0]
      if (active) {
        setClassListYearId(String(active.id))
        setSectionListYearId(String(active.id))
      }
    }
  }, [academicYear?.id, academicYears])

  useEffect(() => {
    if (!editingClass && showClassForm && classListYearId) {
      setClassFormData((prev) => ({ ...prev, academic_year_id: classListYearId }))
    }
  }, [classListYearId, editingClass, showClassForm])

  useEffect(() => {
    setSelectedClassForSection('')
  }, [sectionListYearId])

  useEffect(() => {
    if (!editingSection && showSectionForm && sectionListYearId) {
      setSectionFormData((prev) => ({
        ...prev,
        academic_year_id: prev.academic_year_id || sectionListYearId,
        class_id: prev.class_id || selectedClassForSection,
      }))
    }
  }, [sectionListYearId, selectedClassForSection, editingSection, showSectionForm])

  const { data: classList } = useQuery(
    ['classes', schoolId, classListYearId, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/classes`, {
        params: {
          school_id: schoolId,
          academic_year_id: classListYearId,
        },
        headers: buildBranchScopedHeaders(token, {
          academicYearId: classListYearId,
          branchId: branch?.id,
          isAllBranches,
        }),
      })
      return response.data.data
    },
    { enabled: masterDataReady && !!classListYearId, retry: false }
  )

  const academicYearLabel = (yearId?: number | string) => {
    if (!yearId) return '-'
    const year = academicYears?.find((y: { id: number | string }) => String(y.id) === String(yearId))
    if (!year) return `Year #${yearId}`
    return year.is_active ? `${year.name} (Active)` : year.name
  }
  
  // Subjects state
  const emptySubjectLesson = () => ({ lesson_number: '1', title: '', description: '' })
  const emptySubjectUnit = () => ({
    unit_number: '1',
    title: '',
    description: '',
    lessons: [emptySubjectLesson()],
  })

  const [showSubjectForm, setShowSubjectForm] = useState(false)
  const [editingSubject, setEditingSubject] = useState<any>(null)
  const [subjectUnits, setSubjectUnits] = useState([emptySubjectUnit()])
  const [subjectFormData, setSubjectFormData] = useState({
    name: '',
    code: '',
    type: 'Core',
    description: '',
    class_id: '',
    section_id: '',
    teacher_id: '',
  })
  const [subjectFilterClassId, setSubjectFilterClassId] = useState('')
  const [subjectFilterSectionId, setSubjectFilterSectionId] = useState('')

  // Academic years state
  const [showAcademicYearForm, setShowAcademicYearForm] = useState(false)
  const [editingAcademicYear, setEditingAcademicYear] = useState<any>(null)
  const [academicYearFormData, setAcademicYearFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
  })

  const teacherRoleEditorRef = useRef<HTMLDivElement | null>(null)

  const emptyRoleRow = () => ({
    role_type: '',
    class_id: '',
    section_id: '',
    subject_id: '',
    remarks: '',
  })

  const [selectedTeacherForRoles, setSelectedTeacherForRoles] = useState('')
  const [roleAssignmentRows, setRoleAssignmentRows] = useState([emptyRoleRow()])

  type IdFormatFormState = {
    format_template: string
    prefix: string
    sequence_padding: string
    next_sequence: string
    reset_sequence_yearly: boolean
  }

  const buildDefaultIdFormatForm = (idType: IdFormatType): IdFormatFormState => {
    const meta = getIdFormatTypeMeta(idType)
    return {
      format_template: meta.defaultTemplate,
      prefix: meta.defaultPrefix,
      sequence_padding: '4',
      next_sequence: '1',
      reset_sequence_yearly: true,
    }
  }

  const rowToIdFormatForm = (row: any, idType: IdFormatType): IdFormatFormState => {
    const meta = getIdFormatTypeMeta(idType)
    return {
      format_template: row.format_template || meta.defaultTemplate,
      prefix: row.prefix || meta.defaultPrefix,
      sequence_padding: String(row.sequence_padding || 4),
      next_sequence: String(row.next_sequence || 1),
      reset_sequence_yearly: row.reset_sequence_yearly !== false,
    }
  }

  const [selectedIdType, setSelectedIdType] = useState<IdFormatType>('employee')
  const [idFormatFormsByType, setIdFormatFormsByType] = useState<Record<IdFormatType, IdFormatFormState>>({
    employee: buildDefaultIdFormatForm('employee'),
    student: buildDefaultIdFormatForm('student'),
  })
  const [idFormatPreviewsByType, setIdFormatPreviewsByType] = useState<Record<IdFormatType, string>>({
    employee: '',
    student: '',
  })
  const [idFormatEditing, setIdFormatEditing] = useState(false)
  const [idFormatSaveNotice, setIdFormatSaveNotice] = useState('')

  const idFormatForm = idFormatFormsByType[selectedIdType]
  const idFormatPreview = idFormatPreviewsByType[selectedIdType]

  const patchIdFormatForm = (idType: IdFormatType, patch: Partial<IdFormatFormState>) => {
    setIdFormatFormsByType((prev) => ({
      ...prev,
      [idType]: { ...prev[idType], ...patch },
    }))
  }

  // Fetch sections for subject form
  const { data: subjectFormSections } = useQuery(
    ['subject-form-sections', subjectFormData.class_id, academicYear?.id],
    async () => {
      if (!subjectFormData.class_id) return []
      const response = await axios.get(`${getApiUrl()}/sections`, {
        params: {
          class_id: subjectFormData.class_id,
          school_id: schoolId,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data || []
    },
    { enabled: masterDataReady && !!subjectFormData.class_id && masterTab === 'subjects', retry: false }
  )

  const { data: subjectFilterSections } = useQuery(
    ['subject-filter-sections', subjectFilterClassId, academicYear?.id],
    async () => {
      if (!subjectFilterClassId) return []
      const response = await axios.get(`${getApiUrl()}/sections`, {
        params: {
          class_id: subjectFilterClassId,
          school_id: schoolId,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data || []
    },
    { enabled: masterDataReady && !!subjectFilterClassId && masterTab === 'subjects', retry: false }
  )

  const filteredSubjects = useMemo(() => {
    if (!subjects?.length) return []
    return subjects.filter((subject: any) => {
      if (subjectFilterClassId && String(subject.class_id) !== String(subjectFilterClassId)) {
        return false
      }
      if (subjectFilterSectionId && String(subject.section_id) !== String(subjectFilterSectionId)) {
        return false
      }
      return true
    })
  }, [subjects, subjectFilterClassId, subjectFilterSectionId])

  const subjectFiltersActive = !!(subjectFilterClassId || subjectFilterSectionId)

  const subjectsExport = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Subject Offerings',
      filename: 'subjects',
      columns: [
        { key: 'name', label: 'Subject' },
        { key: 'class_name', label: 'Class' },
        { key: 'section_name', label: 'Section' },
        { key: 'teacher_name', label: 'Teacher' },
        { key: 'type', label: 'Type' },
      ],
      getRows: () =>
        filteredSubjects.map((s: any) => ({
          name: s.name || '',
          class_name: s.class_name || '',
          section_name: s.section_name || '',
          teacher_name: s.teacher_name || '',
          type: s.subject_type || s.type || '',
        })),
    },
  })

  const { data: sectionYearClasses } = useQuery(
    ['classes', schoolId, sectionListYearId, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/classes`, {
        params: {
          school_id: schoolId,
          academic_year_id: sectionListYearId,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': sectionListYearId,
        },
      })
      return response.data.data
    },
    { enabled: masterDataReady && !!sectionListYearId && masterTab === 'sections', retry: false }
  )

  const { data: sectionFormClasses } = useQuery(
    ['classes', schoolId, sectionFormData.academic_year_id, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/classes`, {
        params: {
          school_id: schoolId,
          academic_year_id: sectionFormData.academic_year_id,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': sectionFormData.academic_year_id,
        },
      })
      return response.data.data
    },
    {
      enabled:
        masterDataReady &&
        !!sectionFormData.academic_year_id &&
        showSectionForm &&
        masterTab === 'sections',
      retry: false,
    }
  )

  // Fetch sections for selected class
  const { data: classSections, refetch: refetchSections } = useQuery(
    ['sections', selectedClassForSection, sectionListYearId],
    async () => {
      if (!selectedClassForSection) return []
      const response = await axios.get(`${getApiUrl()}/sections`, {
        params: {
          class_id: selectedClassForSection,
          school_id: schoolId,
          academic_year_id: sectionListYearId,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': sectionListYearId,
        },
      })
      return response.data.data
    },
    { enabled: masterDataReady && !!selectedClassForSection && !!sectionListYearId && masterTab === 'sections' }
  )

  const { data: allSectionsForRoles } = useQuery(
    ['all-sections-roles', schoolId, academicYear?.id],
    async () => {
      const response = await axios.get(`${getApiUrl()}/sections`, {
        params: {
          school_id: schoolId,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data || []
    },
    { enabled: masterDataReady && masterTab === 'teacher-roles', retry: false }
  )

  const { data: teacherRoleAssignments, refetch: refetchTeacherRoles } = useQuery(
    ['teacher-role-assignments', schoolId, academicYear?.id],
    async () => {
      const response = await axios.get(`${getApiUrl()}/teacher-roles`, {
        params: {
          school_id: schoolId,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data || []
    },
    { enabled: masterDataReady && masterTab === 'teacher-roles', retry: false }
  )

  const idFormatRequestParams = {
    school_id: schoolId,
    academic_year_id: academicYear?.id,
    ...(branch?.id && !isAllBranches ? { branch_id: branch.id } : {}),
  }

  const fetchAllIdFormatSettings = async (): Promise<any[]> => {
    const params = idFormatRequestParams

    try {
      const response = await axios.get(`${getApiUrl()}/employee-id-settings/all`, {
        params,
        headers: scopedHeaders,
      })
      const rows = response.data?.data
      if (Array.isArray(rows) && rows.length > 0) {
        return rows
      }
    } catch (err: any) {
      const status = err.response?.status
      if (status !== 404 && status !== 500) {
        console.warn('ID settings /all request failed:', err.response?.data || err.message)
      }
    }

    const rows = await Promise.all(
      ID_FORMAT_TYPES.map(async (type) => {
        const response = await axios.get(`${getApiUrl()}/employee-id-settings`, {
          params: { ...params, id_type: type.id },
          headers: scopedHeaders,
        })
        const row = response.data?.data || {}
        return {
          ...row,
          id_type: type.id,
          label: row.label || type.label,
          preview_id: row.preview_id || row.preview_employee_id,
        }
      })
    )
    return rows
  }

  const {
    data: allIdFormatSettings,
    isLoading: allIdFormatSettingsLoading,
    isError: allIdFormatSettingsError,
    error: allIdFormatSettingsErrorDetail,
    refetch: refetchAllIdFormatSettings,
  } = useQuery(
    ['id-format-settings-all', schoolId, academicYear?.id, branchScopeKey],
    fetchAllIdFormatSettings,
    {
      enabled: !!token && !!schoolId && !!academicYear?.id && masterTab === 'id',
      retry: 1,
      staleTime: 30_000,
    }
  )

  const loadIdFormatFromRow = (row: any, idType: IdFormatType) => {
    setIdFormatFormsByType((prev) => ({
      ...prev,
      [idType]: rowToIdFormatForm(row, idType),
    }))
    setIdFormatPreviewsByType((prev) => ({
      ...prev,
      [idType]: row.preview_id || row.preview_employee_id || '',
    }))
  }

  useEffect(() => {
    if (!allIdFormatSettings?.length || idFormatEditing) return
    setIdFormatFormsByType((prev) => {
      const next = { ...prev }
      for (const row of allIdFormatSettings) {
        const idType = row.id_type as IdFormatType
        if (idType === 'employee' || idType === 'student') {
          next[idType] = rowToIdFormatForm(row, idType)
        }
      }
      return next
    })
    setIdFormatPreviewsByType((prev) => {
      const next = { ...prev }
      for (const row of allIdFormatSettings) {
        const idType = row.id_type as IdFormatType
        if (idType === 'employee' || idType === 'student') {
          next[idType] = row.preview_id || row.preview_employee_id || ''
        }
      }
      return next
    })
  }, [allIdFormatSettings, idFormatEditing])

  const saveIdFormatSettingsMutation = useMutation(
    async (payload: { idType: IdFormatType } & IdFormatFormState) => {
      const { idType, format_template, prefix, sequence_padding, next_sequence, reset_sequence_yearly } =
        payload
      const response = await axios.put(
        `${getApiUrl()}/employee-id-settings`,
        {
          id_type: idType,
          format_template,
          prefix,
          sequence_padding,
          next_sequence,
          reset_sequence_yearly,
          school_id: schoolId,
          academic_year_id: academicYear?.id,
        },
        { headers: scopedHeaders }
      )
      return { ...response.data, savedIdType: idType }
    },
    {
      onSuccess: (data) => {
        const savedIdType = data.savedIdType as IdFormatType
        const saved = data.data || {}
        const preview = saved.preview_id || saved.preview_employee_id || ''

        queryClient.setQueryData(
          ['id-format-settings-all', schoolId, academicYear?.id, branchScopeKey],
          (old: any[] | undefined) => {
            if (!Array.isArray(old)) return old
            return old.map((row) =>
              row.id_type === savedIdType
                ? {
                    ...row,
                    format_template: saved.format_template ?? row.format_template,
                    prefix: saved.prefix ?? row.prefix,
                    sequence_padding: saved.sequence_padding ?? row.sequence_padding,
                    next_sequence: saved.next_sequence ?? row.next_sequence,
                    reset_sequence_yearly:
                      saved.reset_sequence_yearly ?? row.reset_sequence_yearly,
                    preview_id: preview,
                    preview_employee_id: preview,
                    updated_at: new Date().toISOString(),
                  }
                : row
            )
          }
        )

        setIdFormatFormsByType((prev) => ({
          ...prev,
          [savedIdType]: rowToIdFormatForm(
            {
              format_template: saved.format_template,
              prefix: saved.prefix,
              sequence_padding: saved.sequence_padding,
              next_sequence: saved.next_sequence,
              reset_sequence_yearly: saved.reset_sequence_yearly,
            },
            savedIdType
          ),
        }))
        setIdFormatPreviewsByType((prev) => ({ ...prev, [savedIdType]: preview }))
        setIdFormatSaveNotice(`${getIdFormatTypeMeta(savedIdType).label} format saved successfully!`)
        setIdFormatEditing(false)
      },
      onError: (error: any) => {
        const msg =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message
        if (msg === 'Route not found') {
          alert('Backend route not loaded. Restart the server (npm run dev in the server folder), then try again.')
          return
        }
        alert(msg || 'Failed to save ID format')
      },
    }
  )

  const previewIdFormat = async (idType: IdFormatType, draft?: IdFormatFormState) => {
    const form = draft || idFormatFormsByType[idType]
    const setPreview = (value: string) => {
      setIdFormatPreviewsByType((prev) => ({ ...prev, [idType]: value }))
    }
    const localPreview = () => {
      if (!isValidEmployeeIdTemplate(form.format_template)) {
        setPreview('')
        return
      }
      const activeYear = academicYears?.find(
        (y: { id: number | string; is_active?: boolean }) => String(y.id) === String(academicYear?.id)
      )
      const ayMatch = activeYear?.name?.match(/(\d{4})/)
      const academicYearStart = ayMatch?.[1] || String(new Date().getFullYear())
      setPreview(
        renderEmployeeIdPreview(form.format_template, {
          prefix: form.prefix,
          schoolCode: schools?.find((s: { id: number }) => Number(s.id) === Number(schoolId))?.code,
          branchCode: branch?.code,
          year: academicYearStart,
          academicYearStart,
          sequence: Number(form.next_sequence) || 1,
          sequencePadding: Number(form.sequence_padding) || 4,
        })
      )
    }

    localPreview()

    try {
      const response = await axios.post(
        `${getApiUrl()}/employee-id-settings/preview-format`,
        {
          school_id: schoolId,
          academic_year_id: academicYear?.id,
          ...(branch?.id && !isAllBranches ? { branch_id: branch.id } : {}),
          format_template: form.format_template,
          prefix: form.prefix,
          sequence_padding: Number(form.sequence_padding),
          next_sequence: Number(form.next_sequence),
        },
        { headers: scopedHeaders }
      )
      setPreview(response.data.data.preview_id || response.data.data.preview_employee_id)
    } catch {
      localPreview()
    }
  }

  const activeIdFormatForm = idFormatFormsByType[selectedIdType]

  useEffect(() => {
    if (masterTab !== 'id' || !idFormatEditing) return
    previewIdFormat(selectedIdType)
  }, [
    masterTab,
    idFormatEditing,
    selectedIdType,
    activeIdFormatForm.format_template,
    activeIdFormatForm.prefix,
    activeIdFormatForm.sequence_padding,
    activeIdFormatForm.next_sequence,
    academicYear?.id,
    branchScopeKey,
  ])

  useEffect(() => {
    if (!idFormatSaveNotice) return
    const timer = setTimeout(() => setIdFormatSaveNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [idFormatSaveNotice])

  const formatIdSettingsUpdatedAt = (value?: string) => {
    if (!value) return '—'
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  const resetRoleAssignmentForm = () => {
    setRoleAssignmentRows([emptyRoleRow()])
  }

  const openTeacherRolePanel = (teacherId: number | string, mode: 'assign' | 'edit') => {
    setSelectedTeacherForRoles(String(teacherId))
    if (mode === 'assign') {
      resetRoleAssignmentForm()
    } else {
      setRoleAssignmentRows([emptyRoleRow()])
    }
    setTimeout(() => {
      teacherRoleEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
  }

  const addRoleAssignmentRow = () => {
    setRoleAssignmentRows((prev) => [...prev, emptyRoleRow()])
  }

  const updateRoleAssignmentRow = (index: number, field: string, value: string) => {
    setRoleAssignmentRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row
        const updated = { ...row, [field]: value }
        if (field === 'class_id') {
          updated.section_id = ''
        }
        if (field === 'role_type') {
          updated.class_id = ''
          updated.section_id = ''
          updated.subject_id = ''
        }
        return updated
      })
    )
  }

  const removeRoleAssignmentRow = (index: number) => {
    setRoleAssignmentRows((prev) => (prev.length === 1 ? [emptyRoleRow()] : prev.filter((_, i) => i !== index)))
  }

  const assignTeacherRolesMutation = useMutation(
    async (payload: any) => {
      const response = await axios.post(
        `${getApiUrl()}/teacher-roles`,
        {
          ...payload,
          school_id: schoolId,
          academic_year_id: academicYear?.id,
        },
        { headers: scopedHeaders }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
        refetchTeacherRoles()
        resetRoleAssignmentForm()
        alert(data.message || 'Teacher roles assigned successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to assign teacher roles')
      },
    }
  )

  const deleteTeacherRoleMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${getApiUrl()}/teacher-roles/${id}`, {
        headers: scopedHeaders,
        params: { school_id: schoolId },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
        queryClient.invalidateQueries(['teacher-duty-context'])
        refetchTeacherRoles()
        alert('Role assignment removed successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to remove role assignment')
      },
    }
  )

  const handleSaveTeacherRoles = () => {
    if (!selectedTeacherForRoles) {
      alert('Please select a teacher first')
      return
    }

    const assignments = roleAssignmentRows
      .filter((row) => row.role_type)
      .map((row) => ({
        role_type: row.role_type,
        class_id: row.class_id ? Number(row.class_id) : null,
        section_id: row.section_id ? Number(row.section_id) : null,
        subject_id: row.subject_id ? Number(row.subject_id) : null,
        remarks: row.remarks.trim() || null,
      }))

    if (assignments.length === 0) {
      alert('Add at least one role to assign')
      return
    }

    assignTeacherRolesMutation.mutate({
      teacher_id: Number(selectedTeacherForRoles),
      assignments,
    })
  }

  const teacherRoleSummary = (teacherId: number) => {
    return (teacherRoleAssignments || []).filter((item: any) => item.teacher_id === teacherId)
  }

  const handleRemoveTeacherRole = (assignment: any, teacherName?: string) => {
    const label = formatRoleAssignmentLabel(assignment)
    const who = teacherName ? ` from ${teacherName}` : ''
    if (!window.confirm(`Remove role "${label}"${who}? This also clears linked section/subject assignments where applicable.`)) {
      return
    }
    deleteTeacherRoleMutation.mutate(assignment.id)
  }

  const handleRemoveAllTeacherRoles = async (roles: any[], teacherName: string) => {
    if (
      !window.confirm(
        `Remove all ${roles.length} role(s) from ${teacherName}? Section class-teacher and subject links will be cleared where applicable.`
      )
    ) {
      return
    }
    try {
      await Promise.all(
        roles.map((role: any) =>
          axios.delete(`${getApiUrl()}/teacher-roles/${role.id}`, {
            headers: scopedHeaders,
            params: { school_id: schoolId },
          })
        )
      )
      queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
      await refetchTeacherRoles()
      alert('All roles removed successfully!')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to remove some roles')
    }
  }

  const selectedTeacherAssignments = selectedTeacherForRoles
    ? teacherRoleSummary(Number(selectedTeacherForRoles))
    : []

  // Create subject mutation
  const createSubjectMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${getApiUrl()}/subjects`,
        {
          ...data,
          school_id: schoolId,
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
        queryClient.invalidateQueries(['subjects', schoolId, academicYear?.id])
        queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
        resetSubjectForm()
        alert('Subject created successfully!')
      },
      onError: (error: any) => {
        console.error('Create subject error:', error)
        alert(error.response?.data?.error || 'Failed to create subject')
      },
    }
  )

  // Update subject mutation
  const updateSubjectMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${getApiUrl()}/subjects/${id}`,
        {
          ...data,
          school_id: schoolId,
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
        queryClient.invalidateQueries(['subjects', schoolId, academicYear?.id])
        queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
        resetSubjectForm()
        alert('Subject updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update subject error:', error)
        alert(error.response?.data?.error || 'Failed to update subject')
      },
    }
  )

  // Delete subject mutation
  const deleteSubjectMutation = useMutation(
    async ({ id, classSubjectId }: { id: number; classSubjectId?: number }) => {
      const response = await axios.delete(`${getApiUrl()}/subjects/${id}`, {
        params: classSubjectId ? { class_subject_id: classSubjectId } : undefined,
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['subjects', schoolId, academicYear?.id])
        alert('Subject deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete subject error:', error)
        alert(error.response?.data?.error || 'Failed to delete subject')
      },
    }
  )

  // Create section mutation
  const createSectionMutation = useMutation(
    async (data: any) => {
      const yearId = data.academic_year_id
      const response = await axios.post(
        `${getApiUrl()}/sections`,
        {
          ...data,
          school_id: schoolId,
          academic_year_id: yearId,
          class_id: Number(data.class_id),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': String(yearId),
          },
        }
      )
      return response.data
    },
    {
      onSuccess: (_data, variables) => {
        setSectionListYearId(String(variables.academic_year_id))
        setSelectedClassForSection(String(variables.class_id))
        queryClient.invalidateQueries(['sections', String(variables.class_id), variables.academic_year_id])
        queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
        resetSectionForm()
        alert('Section created successfully!')
      },
      onError: (error: any) => {
        console.error('Create section error:', error)
        const msg =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          'Failed to create section'
        alert(msg)
      },
    }
  )

  // Update section mutation
  const updateSectionMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${getApiUrl()}/sections/${id}`,
        {
          ...data,
          school_id: schoolId,
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
        queryClient.invalidateQueries(['sections', selectedClassForSection, sectionListYearId])
        queryClient.invalidateQueries(['teacher-role-assignments', schoolId, academicYear?.id])
        resetSectionForm()
        alert('Section updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update section error:', error)
        alert(error.response?.data?.error || 'Failed to update section')
      },
    }
  )

  // Delete section mutation
  const deleteSectionMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(
        `${getApiUrl()}/sections/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sections', selectedClassForSection, sectionListYearId])
        refetchSections()
        alert('Section deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete section error:', error)
        alert(error.response?.data?.error || 'Failed to delete section')
      },
    }
  )

  // Create class mutation
  const createClassMutation = useMutation(
    async (data: any) => {
      const yearId = data.academic_year_id
      const branchId = data.branch_id
      if (!branchId) {
        throw new Error('Branch is required to create a class')
      }
      const response = await axios.post(
        `${getApiUrl()}/classes`,
        {
          ...data,
          school_id: schoolId,
          academic_year_id: yearId,
          branch_id: branchId,
        },
        {
          headers: buildBranchScopedHeaders(token, {
            academicYearId: yearId,
            branchId,
            isAllBranches: false,
          }),
        }
      )
      return response.data
    },
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(['classes', schoolId, variables.academic_year_id, branchScopeKey])
        queryClient.invalidateQueries(['classes', schoolId, classListYearId, branchScopeKey])
        resetClassForm()
        alert('Class created successfully!')
      },
      onError: (error: any) => {
        console.error('Create class error:', error)
        alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create class')
      },
    }
  )

  // Update class mutation
  const updateClassMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${getApiUrl()}/classes/${id}`,
        data,
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['classes', schoolId, classListYearId, branchScopeKey])
        queryClient.invalidateQueries(['classes', schoolId, academicYear?.id, branchScopeKey])
        resetClassForm()
        alert('Class updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update class error:', error)
        alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to update class')
      },
    }
  )

  // Delete class mutation
  const deleteClassMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(
        `${getApiUrl()}/classes/${id}`,
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['classes', schoolId, classListYearId, branchScopeKey])
        queryClient.invalidateQueries(['classes', schoolId, academicYear?.id, branchScopeKey])
        alert('Class deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete class error:', error)
        alert(error.response?.data?.error || 'Failed to delete class')
      },
    }
  )

  // Academic year mutations
  const createAcademicYearMutation = useMutation(
    async (data: any) => {
      const numericSchoolId = schoolId ? Number(schoolId) : null
      const hasValidSchoolId = Number.isInteger(numericSchoolId) && (numericSchoolId as number) > 0
      const payload: any = {
        ...data,
      }

      // Send school_id only when it is valid; backend validator rejects null.
      if (hasValidSchoolId) {
        payload.school_id = numericSchoolId
      }

      const response = await axios.post(
        `${getApiUrl()}/academic-years`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['academic-years', schoolId])
        loadAcademicYears()
        resetAcademicYearForm()
        alert('Academic year created successfully!')
      },
      onError: (error: any) => {
        console.error('Create academic year error:', error)
        alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create academic year')
      },
    }
  )

  const updateAcademicYearMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${getApiUrl()}/academic-years/${id}`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['academic-years', schoolId])
        loadAcademicYears()
        resetAcademicYearForm()
        alert('Academic year updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update academic year error:', error)
        alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to update academic year')
      },
    }
  )

  const resetSubjectForm = () => {
    setSubjectFormData({
      name: '',
      code: '',
      type: 'Core',
      description: '',
      class_id: '',
      section_id: '',
      teacher_id: '',
    })
    setSubjectUnits([emptySubjectUnit()])
    setEditingSubject(null)
    setShowSubjectForm(false)
  }

  const resetSectionForm = () => {
    setSectionFormData({
      academic_year_id: sectionListYearId || String(academicYear?.id || ''),
      class_id: selectedClassForSection || '',
      name: '',
      code: '',
      capacity: '40',
      class_teacher_id: '',
    })
    setEditingSection(null)
    setShowSectionForm(false)
  }

  const resetClassForm = () => {
    setClassFormData({
      academic_year_id: classListYearId || String(academicYear?.id || ''),
      name: '',
      code: '',
      level: '',
      description: '',
    })
    setEditingClass(null)
    setShowClassForm(false)
  }

  const resetAcademicYearForm = () => {
    setAcademicYearFormData({
      name: '',
      start_date: '',
      end_date: '',
      is_active: false,
    })
    setEditingAcademicYear(null)
    setShowAcademicYearForm(false)
  }

  const buildSubjectPayload = () => ({
    ...subjectFormData,
    class_id: Number(subjectFormData.class_id),
    section_id: Number(subjectFormData.section_id),
    teacher_id: subjectFormData.teacher_id ? Number(subjectFormData.teacher_id) : null,
    class_subject_id: editingSubject?.class_subject_id,
    units: subjectUnits
      .filter((unit) => unit.title.trim())
      .map((unit, unitIndex) => ({
        unit_number: Number(unit.unit_number) || unitIndex + 1,
        title: unit.title.trim(),
        description: unit.description.trim() || null,
        lessons: unit.lessons
          .filter((lesson) => lesson.title.trim())
          .map((lesson, lessonIndex) => ({
            lesson_number: Number(lesson.lesson_number) || lessonIndex + 1,
            title: lesson.title.trim(),
            description: lesson.description.trim() || null,
          })),
      })),
  })

  const handleSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subjectFormData.class_id || !subjectFormData.section_id) {
      alert('Class and section are required')
      return
    }
    const payload = buildSubjectPayload()
    if (editingSubject) {
      updateSubjectMutation.mutate({ id: editingSubject.id, data: payload })
    } else {
      createSubjectMutation.mutate(payload)
    }
  }

  const handleSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionFormData.academic_year_id) {
      alert('Please select an academic year')
      return
    }
    if (!sectionFormData.class_id) {
      alert('Please select a class')
      return
    }
    const payload = {
      name: sectionFormData.name,
      code: sectionFormData.code || null,
      capacity: sectionFormData.capacity || 40,
      class_teacher_id: sectionFormData.class_teacher_id
        ? Number(sectionFormData.class_teacher_id)
        : null,
    }
    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, data: payload })
    } else {
      createSectionMutation.mutate({
        ...payload,
        academic_year_id: Number(sectionFormData.academic_year_id),
        class_id: Number(sectionFormData.class_id),
      })
    }
  }

  const handleEditSubject = async (subject: any) => {
    try {
      const response = await axios.get(`${getApiUrl()}/subjects/${subject.id}`, {
        params: { class_subject_id: subject.class_subject_id },
        headers: scopedHeaders,
      })
      const detail = response.data.data
      setEditingSubject(detail)
      setSubjectFormData({
        name: detail.name || '',
        code: detail.code || '',
        type: detail.type || 'Core',
        description: detail.description || '',
        class_id: detail.class_id ? String(detail.class_id) : '',
        section_id: detail.section_id ? String(detail.section_id) : '',
        teacher_id: detail.teacher_id ? String(detail.teacher_id) : '',
      })
      if (detail.syllabus?.length) {
        setSubjectUnits(
          detail.syllabus.map((unit: any, index: number) => ({
            unit_number: String(unit.unit_number || index + 1),
            title: unit.title || '',
            description: unit.description || '',
            lessons: (unit.lessons?.length ? unit.lessons : [emptySubjectLesson()]).map(
              (lesson: any, lessonIndex: number) => ({
                lesson_number: String(lesson.lesson_number || lessonIndex + 1),
                title: lesson.title || '',
                description: lesson.description || '',
              })
            ),
          }))
        )
      } else {
        setSubjectUnits([emptySubjectUnit()])
      }
      setShowSubjectForm(true)
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load subject details')
    }
  }

  const handleEditSection = (section: any) => {
    setEditingSection(section)
    setSectionFormData({
      academic_year_id: String(section.academic_year_id || sectionListYearId || ''),
      class_id: String(section.class_id || ''),
      name: section.name || '',
      code: section.code || '',
      capacity: String(section.capacity || 40),
      class_teacher_id: section.class_teacher_id || '',
    })
    setSelectedClassForSection(String(section.class_id))
    setShowSectionForm(true)
  }

  const handleDeleteSubject = (subject: any) => {
    if (
      window.confirm(
        `Delete "${subject.name}" for ${subject.class_name || 'class'} ${subject.section_name || ''}? This cannot be undone.`
      )
    ) {
      deleteSubjectMutation.mutate({
        id: subject.id,
        classSubjectId: subject.class_subject_id,
      })
    }
  }

  const handleDeleteSection = (section: any) => {
    if (window.confirm(`Are you sure you want to delete the section "${section.name}"? This action cannot be undone.`)) {
      deleteSectionMutation.mutate(section.id)
    }
  }

  const handleClassSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageBranchScopedData) {
      alert('Select a specific branch from the top bar to add or edit classes.')
      return
    }
    if (!classFormData.academic_year_id) {
      alert('Please select an academic year')
      return
    }

    const payload = {
      name: classFormData.name,
      code: classFormData.code || null,
      level: classFormData.level || null,
      description: classFormData.description || null,
    }

    if (editingClass) {
      updateClassMutation.mutate({ id: editingClass.id, data: payload })
    } else {
      createClassMutation.mutate({
        ...payload,
        academic_year_id: Number(classFormData.academic_year_id),
        branch_id: branch!.id,
      })
    }
  }

  const handleEditClass = (cls: any) => {
    setEditingClass(cls)
    setClassFormData({
      academic_year_id: String(cls.academic_year_id || classListYearId || ''),
      name: cls.name || '',
      code: cls.code || '',
      level: cls.level ? String(cls.level) : '',
      description: cls.description || '',
    })
    setShowClassForm(true)
  }

  const handleDeleteClass = (cls: any) => {
    if (window.confirm(`Are you sure you want to delete class "${cls.name}"? This action cannot be undone.`)) {
      deleteClassMutation.mutate(cls.id)
    }
  }

  const handleAcademicYearSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!academicYearFormData.name.trim() || !academicYearFormData.start_date || !academicYearFormData.end_date) {
      alert('Please fill all required fields')
      return
    }

    if (new Date(academicYearFormData.start_date) >= new Date(academicYearFormData.end_date)) {
      alert('End date must be after start date')
      return
    }

    if (!schoolId) {
      alert('Please select a school first')
      return
    }

    if (editingAcademicYear) {
      updateAcademicYearMutation.mutate({ id: editingAcademicYear.id, data: academicYearFormData })
    } else {
      createAcademicYearMutation.mutate(academicYearFormData)
    }
  }

  const handleEditAcademicYear = (year: any) => {
    const formatDateForInput = (dateString: string) => {
      const date = new Date(dateString)
      const yearValue = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${yearValue}-${month}-${day}`
    }

    setEditingAcademicYear(year)
    setAcademicYearFormData({
      name: year.name || '',
      start_date: year.start_date ? formatDateForInput(year.start_date) : '',
      end_date: year.end_date ? formatDateForInput(year.end_date) : '',
      is_active: year.is_active || false,
    })
    setShowAcademicYearForm(true)
  }

  return (
    <div className="master-data-layout">
      {permissionsReady && visibleMasterTabs.length === 0 ? (
        <div className="glass-card p-4 text-sm text-amber-200 w-full">
          No Master Data sections are enabled for your role. Ask School Admin to grant specific
          Master Data features under <strong>Features → Branch In Charge</strong>.
        </div>
      ) : (
        <>
          <aside className="master-data-sidebar" aria-label="Master data navigation">
            <div className="master-data-sidebar-header">
              <p className="master-data-sidebar-title">Master Data</p>
              <p className="master-data-sidebar-subtitle tabular-nums">
                {visibleMasterTabs.length} modules
              </p>
            </div>
            <nav className="master-data-sidebar-nav" aria-label="Master data sections">
              {groupedMasterTabs.map((group) => (
                <div key={group.label} className="master-data-nav-group">
                  <p className="master-data-nav-group-label">{group.label}</p>
                  <div className="master-data-nav-group-items">
                    {group.tabs.map((tabId) => (
                      <button
                        key={tabId}
                        type="button"
                        onClick={() => setMasterTab(tabId as MasterDataTab)}
                        className={`master-data-nav-item ${
                          masterTab === tabId ? 'master-data-nav-item-active' : ''
                        }`}
                        aria-current={masterTab === tabId ? 'page' : undefined}
                        title={MASTER_DATA_TAB_LABELS[tabId] || tabId}
                      >
                        {MASTER_DATA_TAB_SHORT_LABELS[tabId] || MASTER_DATA_TAB_LABELS[tabId] || tabId}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <div className="master-data-content">
            <div className="master-data-content-scroll flex flex-col min-h-0">

      {/* Branch Management Tab */}
      {masterTab === 'branches' && schoolId && (
        <BranchManagementTab schoolId={Number(schoolId)} />
      )}

      {/* Academic Years Tab */}
      {masterTab === 'academic-years' && (
        <>
          <MasterDataTabShell
            title="Academic Years"
            subtitle={`${academicYears?.length || 0} year${(academicYears?.length || 0) === 1 ? '' : 's'}`}
            toolbarActions={
              <>
                <MasterDataToolbarLink href={`/master-data/clone${schoolId ? `?schoolId=${schoolId}` : ''}`}>
                  Clone Data
                </MasterDataToolbarLink>
                <MasterDataToolbarBtn
                  onClick={() => (showAcademicYearForm ? resetAcademicYearForm() : setShowAcademicYearForm(true))}
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>{showAcademicYearForm ? 'Cancel' : 'New Year'}</span>
                </MasterDataToolbarBtn>
              </>
            }
            footer={
              academicYears?.length
                ? `Showing ${academicYears.length} of ${academicYears.length} years`
                : undefined
            }
          >
            {academicYears && academicYears.length > 0 ? (
              <MasterDataDenseTable>
                <table className="data-table data-table-fit w-full academic-years-page-table">
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
                    {academicYears.map((year: any) => (
                      <tr key={year.id} className="master-data-table-row hover:bg-white/[0.04]">
                        <td className="max-w-0">
                          <span className="md-cell-text font-medium text-white" title={year.name}>{year.name}</span>
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {year.start_date
                            ? new Date(year.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
                            : '—'}
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {year.end_date
                            ? new Date(year.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
                            : '—'}
                        </td>
                        <td className="text-center">
                          <MasterDataStatusTag active={year.is_active} label={year.is_active ? 'Active' : 'Inactive'} />
                          {year.is_locked ? <MasterDataStatusTag label="Locked" tone="locked" /> : null}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => handleEditAcademicYear(year)} className="md-action-link md-action-edit">Edit</button>
                            <Link href={`/master-data/clone?sourceYearId=${year.id}&schoolId=${schoolId}`} className="md-action-link md-action-clone">Clone</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MasterDataDenseTable>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                No academic years found. Click <strong className="text-white/75">New Year</strong> to create one.
              </div>
            )}
          </MasterDataTabShell>

          {showAcademicYearForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
              <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
                <h3 className="modal-title mb-4">
                  {editingAcademicYear ? 'Edit Academic Year' : 'Create Academic Year'}
                </h3>
                <form onSubmit={handleAcademicYearSubmit} className="space-y-3">
                  <div>
                    <label className="label-text text-xs mb-1">
                      Academic Year Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={academicYearFormData.name}
                      onChange={(e) => setAcademicYearFormData((prev) => ({ ...prev, name: e.target.value }))}
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
                        value={academicYearFormData.start_date}
                        onChange={(e) => setAcademicYearFormData((prev) => ({ ...prev, start_date: e.target.value }))}
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
                        value={academicYearFormData.end_date}
                        onChange={(e) => setAcademicYearFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                        required
                        className="input-field input-field-compact w-full"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={academicYearFormData.is_active}
                      onChange={(e) => setAcademicYearFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                      className="h-3.5 w-3.5 rounded border-white/30"
                    />
                    Set as active academic year
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={resetAcademicYearForm} className="btn-secondary btn-compact">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createAcademicYearMutation.isLoading || updateAcademicYearMutation.isLoading}
                      className="btn-primary btn-compact disabled:opacity-50"
                    >
                      {editingAcademicYear
                        ? updateAcademicYearMutation.isLoading
                          ? 'Updating…'
                          : 'Update'
                        : createAcademicYearMutation.isLoading
                          ? 'Creating…'
                          : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Subjects Tab */}
      {masterTab === 'subjects' && (
        <>
          <MasterDataTabShell
            title="Subjects"
            subtitle={`${filteredSubjects.length}${subjectFiltersActive && subjects?.length ? ` of ${subjects.length}` : ''} records`}
            filters={
              <>
                <PageFilterField label="Class" hideLabel className="master-data-tab-select-wide">
                  <SelectField
                    id="subject-filter-class"
                    value={subjectFilterClassId}
                    onChange={(e) => {
                      setSubjectFilterClassId(e.target.value)
                      setSubjectFilterSectionId('')
                    }}
                    className="select-field w-full"
                    aria-label="Filter by class"
                  >
                    <option value="">All classes</option>
                    {classes?.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </SelectField>
                </PageFilterField>
                <PageFilterField label="Section" hideLabel className="master-data-tab-select-wide">
                  <SelectField
                    id="subject-filter-section"
                    value={subjectFilterSectionId}
                    onChange={(e) => setSubjectFilterSectionId(e.target.value)}
                    disabled={!subjectFilterClassId}
                    className="select-field w-full disabled:opacity-50"
                    aria-label="Filter by section"
                  >
                    <option value="">All sections</option>
                    {subjectFilterSections?.map((sec: any) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </SelectField>
                </PageFilterField>
                {subjectFiltersActive ? (
                  <MasterDataToolbarBtn
                    variant="secondary"
                    onClick={() => {
                      setSubjectFilterClassId('')
                      setSubjectFilterSectionId('')
                    }}
                  >
                    Clear
                  </MasterDataToolbarBtn>
                ) : null}
                <ExportMenu
                  onExport={subjectsExport.handleExport}
                  isExporting={subjectsExport.isExporting}
                  recordCount={filteredSubjects.length}
                  size="sm"
                />
              </>
            }
            toolbarActions={
              <MasterDataToolbarBtn
                onClick={() => {
                  if (showSubjectForm) resetSubjectForm()
                  else setShowSubjectForm(true)
                }}
              >
                <span>{showSubjectForm ? 'Cancel' : 'Add Subject'}</span>
              </MasterDataToolbarBtn>
            }
            footer={
              filteredSubjects.length
                ? `Showing ${filteredSubjects.length}${subjectFiltersActive && subjects?.length ? ` of ${subjects.length}` : ''} records`
                : undefined
            }
          >
            {subjects && subjects.length > 0 ? (
              filteredSubjects.length > 0 ? (
                <MasterDataDenseTable>
                  <table className="data-table data-table-fit w-full">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Sec.</th>
                        <th>Type</th>
                        <th>Syllabus</th>
                        <th>Teacher</th>
                        <th className="text-center">Act.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {filteredSubjects.map((subject: any) => (
                        <tr key={subject.class_subject_id || subject.id} className="master-data-table-row hover:bg-white/[0.04]">
                          <td className="max-w-0">
                            <span className="md-cell-text font-medium text-white">{subject.name}</span>
                            {subject.code ? <span className="block text-[10px] text-white/45 truncate">{subject.code}</span> : null}
                          </td>
                          <td className="max-w-0"><span className="md-cell-text">{subject.class_name || '—'}</span></td>
                          <td className="max-w-0"><span className="md-cell-text">{subject.section_name || '—'}</span></td>
                          <td className="max-w-0"><span className="md-cell-text">{subject.type}</span></td>
                          <td className="tabular-nums whitespace-nowrap text-[11px] text-white/70">
                            {subject.unit_count || 0}u · {subject.lesson_count || 0}l
                          </td>
                          <td className="max-w-0"><span className="md-cell-text">{subject.teacher_name || '—'}</span></td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button type="button" onClick={() => handleEditSubject(subject)} className="md-action-link md-action-edit">Edit</button>
                              <button type="button" onClick={() => handleDeleteSubject(subject)} className="md-action-link md-action-delete">Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </MasterDataDenseTable>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8 text-center px-4">
                  No subjects match filters.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectFilterClassId('')
                      setSubjectFilterSectionId('')
                    }}
                    className="text-blue-300 hover:text-blue-200 font-medium ml-1"
                  >
                    Clear filters
                  </button>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8 text-center px-4">
                No subjects yet. Create classes and sections first, then add subjects.
              </div>
            )}
          </MasterDataTabShell>

          {showSubjectForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
              <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
                <h3 className="modal-title mb-4">
                  {editingSubject ? 'Edit Subject & Syllabus' : 'Add New Subject'}
                </h3>
              <form onSubmit={handleSubjectSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label-text">Class <span className="text-red-600">*</span></label>
                    <SelectField
                      value={subjectFormData.class_id}
                      onChange={(e) =>
                        setSubjectFormData((prev) => ({ ...prev, class_id: e.target.value, section_id: '' }))
                      }
                      required
                      className="select-field"
                      disabled={!!editingSubject}
                    >
                      <option value="">Select class</option>
                      {classes?.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="label-text">Section <span className="text-red-600">*</span></label>
                    <SelectField
                      value={subjectFormData.section_id}
                      onChange={(e) => setSubjectFormData((prev) => ({ ...prev, section_id: e.target.value }))}
                      required
                      disabled={!subjectFormData.class_id || !!editingSubject}
                      className="select-field"
                    >
                      <option value="">Select section</option>
                      {subjectFormSections?.map((sec: any) => (
                        <option key={sec.id} value={sec.id}>{sec.name}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="label-text">Subject Teacher (optional)</label>
                    <SelectField
                      value={subjectFormData.teacher_id}
                      onChange={(e) => setSubjectFormData((prev) => ({ ...prev, teacher_id: e.target.value }))}
                      className="select-field"
                    >
                      <option value="">Not assigned</option>
                      {teachers?.map((teacher: any) => (
                        <option key={teacher.id} value={teacher.user_id}>{teacher.name}</option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Subject Name <span className="text-red-600">*</span></label>
                    <input
                      type="text"
                      value={subjectFormData.name}
                      onChange={(e) => setSubjectFormData((prev) => ({ ...prev, name: e.target.value }))}
                      required
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Subject Code</label>
                    <input
                      type="text"
                      value={subjectFormData.code}
                      onChange={(e) => setSubjectFormData((prev) => ({ ...prev, code: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Type</label>
                    <SelectField
                      value={subjectFormData.type}
                      onChange={(e) => setSubjectFormData((prev) => ({ ...prev, type: e.target.value }))}
                      className="select-field"
                    >
                      <option value="Core">Core</option>
                      <option value="Elective">Elective</option>
                      <option value="Optional">Optional</option>
                      <option value="Extra Curricular">Extra Curricular</option>
                    </SelectField>
                  </div>
                </div>

                <div>
                  <label className="label-text">Description</label>
                  <textarea value={subjectFormData.description} onChange={(e) => setSubjectFormData((prev) => ({ ...prev, description: e.target.value }))} rows={2} className="input-field resize-none" />
                </div>

                <div className="rounded-lg border border-white/15 p-4 space-y-3 bg-black/20">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white/90">Syllabus (Units & Lessons) — optional</h4>
                    <button
                      type="button"
                      onClick={() => setSubjectUnits((prev) => [...prev, emptySubjectUnit()])}
                      className="btn-secondary px-3 py-1 text-xs"
                    >
                      + Add Unit
                    </button>
                  </div>

                  {subjectUnits.map((unit, unitIndex) => (
                    <div key={unitIndex} className="rounded-lg border border-white/10 bg-black/25 p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <label className="label-text">Unit No.</label>
                          <input
                            type="number"
                            min="1"
                            value={unit.unit_number}
                            onChange={(e) =>
                              setSubjectUnits((prev) =>
                                prev.map((row, i) => (i === unitIndex ? { ...row, unit_number: e.target.value } : row))
                              )
                            }
                            className="input-field"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="label-text">Unit Title</label>
                          <input
                            type="text"
                            value={unit.title}
                            onChange={(e) =>
                              setSubjectUnits((prev) =>
                                prev.map((row, i) => (i === unitIndex ? { ...row, title: e.target.value } : row))
                              )
                            }
                            placeholder="e.g. Algebra Basics"
                            className="input-field"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() =>
                              setSubjectUnits((prev) =>
                                prev.length === 1 ? [emptySubjectUnit()] : prev.filter((_, i) => i !== unitIndex)
                              )
                            }
                            className="w-full px-3 py-2 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                          >
                            Remove Unit
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 pl-2 border-l-2 border-white/20">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-white/70">Lessons</p>
                          <button
                            type="button"
                            onClick={() =>
                              setSubjectUnits((prev) =>
                                prev.map((row, i) =>
                                  i === unitIndex
                                    ? { ...row, lessons: [...row.lessons, emptySubjectLesson()] }
                                    : row
                                )
                              )
                            }
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            + Add Lesson
                          </button>
                        </div>
                        {unit.lessons.map((lesson, lessonIndex) => (
                          <div key={lessonIndex} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <input
                              type="number"
                              min="1"
                              value={lesson.lesson_number}
                              onChange={(e) =>
                                setSubjectUnits((prev) =>
                                  prev.map((row, i) =>
                                    i === unitIndex
                                      ? {
                                          ...row,
                                          lessons: row.lessons.map((l, li) =>
                                            li === lessonIndex ? { ...l, lesson_number: e.target.value } : l
                                          ),
                                        }
                                      : row
                                  )
                                )
                              }
                              className="input-field"
                              placeholder="No."
                            />
                            <input
                              type="text"
                              value={lesson.title}
                              onChange={(e) =>
                                setSubjectUnits((prev) =>
                                  prev.map((row, i) =>
                                    i === unitIndex
                                      ? {
                                          ...row,
                                          lessons: row.lessons.map((l, li) =>
                                            li === lessonIndex ? { ...l, title: e.target.value } : l
                                          ),
                                        }
                                      : row
                                  )
                                )
                              }
                              className="input-field md:col-span-2"
                              placeholder="Lesson title"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setSubjectUnits((prev) =>
                                  prev.map((row, i) =>
                                    i === unitIndex
                                      ? {
                                          ...row,
                                          lessons:
                                            row.lessons.length === 1
                                              ? [emptySubjectLesson()]
                                              : row.lessons.filter((_, li) => li !== lessonIndex),
                                        }
                                      : row
                                  )
                                )
                              }
                              className="px-2 py-2 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetSubjectForm} className="btn-secondary btn-compact">Cancel</button>
                  <button type="submit" className="btn-primary btn-compact">
                    {editingSubject ? 'Update Subject' : 'Create Subject'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sections Tab */}
      {masterTab === 'sections' && (
        <>
          <MasterDataTabShell
            title="Sections"
            subtitle={
              selectedClassForSection
                ? `${classSections?.length || 0} · ${sectionYearClasses?.find((c: any) => c.id === Number(selectedClassForSection))?.name || 'class'}`
                : `${branchLabel}`
            }
            filters={
              <>
                <PageFilterField label="Year" hideLabel className="master-data-tab-select-wide">
                  <SelectField
                    value={sectionListYearId}
                    onChange={(e) => setSectionListYearId(e.target.value)}
                    className="select-field w-full"
                    aria-label="Academic year"
                  >
                    {academicYears?.length ? (
                      academicYears.map((year: { id: number | string; name: string; is_active?: boolean }) => (
                        <option key={year.id} value={year.id}>
                          {year.name}{year.is_active ? ' (Active)' : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">No years</option>
                    )}
                  </SelectField>
                </PageFilterField>
                <PageFilterField label="Class" hideLabel className="master-data-tab-select-wide">
                  <SelectField
                    value={selectedClassForSection}
                    onChange={(e) => setSelectedClassForSection(e.target.value)}
                    className="select-field w-full"
                    disabled={!sectionListYearId}
                    aria-label="Class"
                  >
                    <option value="">Select class</option>
                    {sectionYearClasses?.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>{cls.name}</option>
                    ))}
                  </SelectField>
                </PageFilterField>
              </>
            }
            toolbarActions={
              <MasterDataToolbarBtn
                disabled={!sectionListYearId}
                onClick={() => {
                  if (showSectionForm) resetSectionForm()
                  else {
                    setSectionFormData((prev) => ({
                      ...prev,
                      academic_year_id: sectionListYearId || String(academicYear?.id || ''),
                      class_id: selectedClassForSection || '',
                    }))
                    setShowSectionForm(true)
                  }
                }}
              >
                <span>{showSectionForm ? 'Cancel' : 'Add Section'}</span>
              </MasterDataToolbarBtn>
            }
            footer={
              selectedClassForSection && classSections?.length
                ? `Showing ${classSections.length} records`
                : undefined
            }
          >
            {selectedClassForSection && classSections && classSections.length > 0 ? (
              <MasterDataDenseTable>
                <table className="data-table data-table-fit w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th className="text-center">Cap.</th>
                      <th className="text-center">Str.</th>
                      <th>Teacher</th>
                      <th className="text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {classSections.map((section: any) => (
                      <tr key={section.id} className="master-data-table-row hover:bg-white/[0.04]">
                        <td className="max-w-0"><span className="md-cell-text font-medium text-white">{section.name}</span></td>
                        <td className="max-w-0"><span className="md-cell-text">{section.code || '—'}</span></td>
                        <td className="text-center tabular-nums">{section.capacity || '—'}</td>
                        <td className="text-center tabular-nums">{section.current_strength || 0}</td>
                        <td className="max-w-0"><span className="md-cell-text">{section.class_teacher_name || '—'}</span></td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => handleEditSection(section)} className="md-action-link md-action-edit">Edit</button>
                            <button type="button" onClick={() => handleDeleteSection(section)} className="md-action-link md-action-delete">Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MasterDataDenseTable>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8 text-center px-4">
                {selectedClassForSection
                  ? 'No sections for this class. Click Add Section to create one.'
                  : 'Select an academic year and class to view sections.'}
              </div>
            )}
          </MasterDataTabShell>

          {showSectionForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
              <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
                <h3 className="modal-title mb-4">{editingSection ? 'Edit Section' : 'Add Section'}</h3>
                <form onSubmit={handleSectionSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="label-text text-xs mb-1">Academic Year <span className="text-red-400">*</span></label>
                    <SelectField
                      value={sectionFormData.academic_year_id}
                      onChange={(e) =>
                        setSectionFormData((prev) => ({
                          ...prev,
                          academic_year_id: e.target.value,
                          class_id: '',
                        }))
                      }
                      required
                      disabled={!!editingSection}
                      className="select-field w-full"
                    >
                      <option value="">Select academic year</option>
                      {academicYears?.map((year: { id: number | string; name: string; is_active?: boolean }) => (
                        <option key={year.id} value={year.id}>
                          {year.name}{year.is_active ? ' (Active)' : ''}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Class <span className="text-red-400">*</span></label>
                    <SelectField
                      value={sectionFormData.class_id}
                      onChange={(e) => setSectionFormData((prev) => ({ ...prev, class_id: e.target.value }))}
                      required
                      disabled={!!editingSection || !sectionFormData.academic_year_id}
                      className="select-field w-full"
                    >
                      <option value="">Select class</option>
                      {sectionFormClasses?.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Section Name <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={sectionFormData.name}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="input-field input-field-compact w-full"
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Section Code</label>
                    <input
                      type="text"
                      value={sectionFormData.code}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, code: e.target.value }))}
                      className="input-field input-field-compact w-full"
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Capacity</label>
                    <input
                      type="number"
                      value={sectionFormData.capacity}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, capacity: e.target.value }))}
                      className="input-field input-field-compact w-full"
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Class Teacher</label>
                    <SelectField
                      value={sectionFormData.class_teacher_id}
                      onChange={(e) => setSectionFormData(prev => ({ ...prev, class_teacher_id: e.target.value }))}
                      className="select-field w-full"
                    >
                      <option value="">No Teacher</option>
                      {teachers?.map((teacher: any) => (
                        <option key={teacher.id} value={teacher.user_id}>
                          {teacher.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={resetSectionForm} className="btn-secondary btn-compact">Cancel</button>
                  <button type="submit" className="btn-primary btn-compact">
                    {editingSection ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          )}
        </>
      )}

      {/* Classes Tab */}
      {masterTab === 'classes' && (
        <>
          <MasterDataTabShell
            title="Classes"
            subtitle={`${classList?.length || 0} · ${branchLabel}`}
            filters={
              <PageFilterField label="Year" hideLabel className="master-data-tab-select-wide">
                <SelectField
                  value={classListYearId}
                  onChange={(e) => setClassListYearId(e.target.value)}
                  className="select-field w-full"
                  aria-label="Academic year"
                >
                  {academicYears?.length ? (
                    academicYears.map((year: { id: number | string; name: string; is_active?: boolean }) => (
                      <option key={year.id} value={year.id}>
                        {year.name}{year.is_active ? ' (Active)' : ''}
                      </option>
                    ))
                  ) : (
                    <option value="">No years</option>
                  )}
                </SelectField>
              </PageFilterField>
            }
            toolbarActions={
              <MasterDataToolbarBtn
                disabled={!classListYearId || !canManageBranchScopedData}
                onClick={() => {
                  if (showClassForm) resetClassForm()
                  else {
                    setClassFormData((prev) => ({
                      ...prev,
                      academic_year_id: classListYearId || String(academicYear?.id || ''),
                    }))
                    setShowClassForm(true)
                  }
                }}
              >
                <span>{showClassForm ? 'Cancel' : 'Add Class'}</span>
              </MasterDataToolbarBtn>
            }
            footer={classList?.length ? `Showing ${classList.length} records` : undefined}
          >
            <div className="master-data-tab-banner">
              Branch: {branchLabel}
              {isAllBranches ? ' — Select a branch in the top bar to add or edit classes.' : ''}
            </div>
            {!canManageBranchScopedData ? (
              <div className="master-data-tab-banner text-amber-200/90">
                Choose a single branch (not &quot;All branches&quot;) to create classes.
              </div>
            ) : null}
            {classList && classList.length > 0 ? (
              <MasterDataDenseTable>
                <table className="data-table data-table-fit w-full">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Year</th>
                      <th>Code</th>
                      <th>Level</th>
                      <th className="text-center">Sec.</th>
                      <th className="text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {classList.map((cls: any) => (
                      <tr key={cls.id} className="master-data-table-row hover:bg-white/[0.04]">
                        <td className="max-w-0"><span className="md-cell-text font-medium text-white">{cls.name}</span></td>
                        <td className="max-w-0"><span className="md-cell-text">{academicYearLabel(cls.academic_year_id)}</span></td>
                        <td className="max-w-0"><span className="md-cell-text">{cls.code || '—'}</span></td>
                        <td className="tabular-nums">{cls.level || '—'}</td>
                        <td className="text-center tabular-nums">{cls.section_count || 0}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => handleEditClass(cls)} className="md-action-link md-action-edit">Edit</button>
                            <button type="button" onClick={() => handleDeleteClass(cls)} disabled={deleteClassMutation.isLoading} className="md-action-link md-action-delete">Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MasterDataDenseTable>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                No classes for {academicYearLabel(classListYearId)} at {branchLabel}.
              </div>
            )}
          </MasterDataTabShell>

          {showClassForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
              <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 shadow-2xl">
                <h3 className="modal-title mb-4">{editingClass ? 'Edit Class' : 'Add Class'}</h3>
                <form onSubmit={handleClassSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label-text text-xs mb-1">Academic Year <span className="text-red-400">*</span></label>
                      <SelectField value={classFormData.academic_year_id} onChange={(e) => setClassFormData((prev) => ({ ...prev, academic_year_id: e.target.value }))} required disabled={!!editingClass} className="select-field w-full">
                        <option value="">Select year</option>
                        {academicYears?.map((year: { id: number | string; name: string; is_active?: boolean }) => (
                          <option key={year.id} value={year.id}>{year.name}{year.is_active ? ' (Active)' : ''}</option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label className="label-text text-xs mb-1">Class Name <span className="text-red-400">*</span></label>
                      <input type="text" value={classFormData.name} onChange={(e) => setClassFormData((prev) => ({ ...prev, name: e.target.value }))} required className="input-field input-field-compact w-full" />
                    </div>
                    <div>
                      <label className="label-text text-xs mb-1">Code</label>
                      <input type="text" value={classFormData.code} onChange={(e) => setClassFormData((prev) => ({ ...prev, code: e.target.value }))} className="input-field input-field-compact w-full" />
                    </div>
                    <div>
                      <label className="label-text text-xs mb-1">Level</label>
                      <input type="number" min="1" value={classFormData.level} onChange={(e) => setClassFormData((prev) => ({ ...prev, level: e.target.value }))} className="input-field input-field-compact w-full" />
                    </div>
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1">Description</label>
                    <textarea value={classFormData.description} onChange={(e) => setClassFormData((prev) => ({ ...prev, description: e.target.value }))} rows={2} className="input-field input-field-compact w-full resize-none" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={resetClassForm} className="btn-secondary btn-compact">Cancel</button>
                    <button type="submit" disabled={createClassMutation.isLoading || updateClassMutation.isLoading} className="btn-primary btn-compact disabled:opacity-50">
                      {editingClass ? (updateClassMutation.isLoading ? 'Updating…' : 'Update') : (createClassMutation.isLoading ? 'Creating…' : 'Create')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transport Tab */}
      {masterTab === 'transport' && (
        <TransportMasterTab
          schoolId={schoolId}
          headers={scopedHeaders}
          ready={!!token && !!schoolId}
        />
      )}

      {/* Teacher Roles Tab */}
      {masterTab === 'teacher-roles' && (
        <>
          <MasterDataTabShell
            title="Teacher Roles"
            subtitle={`${teachers?.length || 0} teachers`}
            footer={teachers?.length ? `Showing ${teachers.length} records` : undefined}
          >
            {teachers && teachers.length > 0 ? (
              <MasterDataDenseTable>
                <table className="data-table data-table-fit w-full">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Emp. ID</th>
                      <th>Roles</th>
                      <th className="text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {teachers.map((teacher: any) => {
                      const roles = teacherRoleSummary(teacher.id)
                      return (
                        <tr key={teacher.id} className="master-data-table-row hover:bg-white/[0.04]">
                          <td className="max-w-0"><span className="md-cell-text font-medium text-white">{teacher.name}</span></td>
                          <td className="max-w-0"><span className="md-cell-text tabular-nums">{teacher.employee_id}</span></td>
                          <td>
                            {roles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {roles.map((role: any) => (
                                  <span
                                    key={role.id}
                                    className="inline-flex items-center gap-0.5 pl-1.5 pr-0.5 py-0.5 text-[10px] font-medium rounded-full bg-white/10 text-white/85 border border-white/15"
                                  >
                                    <span className="max-w-[120px] truncate">{formatRoleAssignmentLabel(role)}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTeacherRole(role, teacher.name)}
                                      className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-white/60 hover:bg-red-500/20 hover:text-red-300"
                                      title="Remove this role"
                                      aria-label={`Remove ${formatRoleAssignmentLabel(role)}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-white/40">No roles</span>
                            )}
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {roles.length > 0 ? (
                                <>
                                  <button type="button" onClick={() => openTeacherRolePanel(teacher.id, 'edit')} className="md-action-link md-action-edit">Edit</button>
                                  <button type="button" onClick={() => handleRemoveAllTeacherRoles(roles, teacher.name)} className="md-action-link md-action-delete">Clear</button>
                                </>
                              ) : (
                                <button type="button" onClick={() => openTeacherRolePanel(teacher.id, 'assign')} className="md-action-link md-action-edit">Assign</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </MasterDataDenseTable>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                No teachers found. Add teachers from the Teachers module first.
              </div>
            )}
          </MasterDataTabShell>

          {selectedTeacherForRoles && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
              <div ref={teacherRoleEditorRef} className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="modal-title">Manage Teacher Roles</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedTeacherForRoles('')}
                    className="text-white/50 hover:text-white text-lg leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Select Teacher <span className="text-red-600">*</span>
              </label>
              <SelectField
                value={selectedTeacherForRoles}
                onChange={(e) => {
                  const nextId = e.target.value
                  setSelectedTeacherForRoles(nextId)
                  const hasRoles =
                    nextId &&
                    (teacherRoleAssignments || []).some(
                      (item: any) => String(item.teacher_id) === String(nextId)
                    )
                  if (!hasRoles) {
                    resetRoleAssignmentForm()
                  } else {
                    setRoleAssignmentRows([emptyRoleRow()])
                  }
                }}
                className="select-field max-w-xl"
              >
                <option value="">Choose a teacher</option>
                {teachers?.map((teacher: any) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name} ({teacher.employee_id})
                  </option>
                ))}
              </SelectField>
            </div>

            {selectedTeacherForRoles && (
              <>
                <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {selectedTeacherAssignments.length > 0
                        ? 'Edit Roles — add more duties'
                        : 'Assign Roles'}
                    </h3>
                    <button
                      type="button"
                      onClick={addRoleAssignmentRow}
                      className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
                    >
                      + Add Another Role
                    </button>
                  </div>

                  {roleAssignmentRows.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end bg-white p-3 rounded-lg border border-slate-200">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                        <SelectField
                          value={row.role_type}
                          onChange={(e) => updateRoleAssignmentRow(index, 'role_type', e.target.value)}
                          className="select-field"
                        >
                          <option value="">Select role</option>
                          {TEACHER_DUTY_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </SelectField>
                      </div>

                      {(roleNeedsClassSection(row.role_type) || row.role_type === 'Subject Teacher' || row.role_type === 'Incharge') && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
                          <SelectField
                            value={row.class_id}
                            onChange={(e) => updateRoleAssignmentRow(index, 'class_id', e.target.value)}
                            className="select-field"
                          >
                            <option value="">Select class</option>
                            {classes?.map((cls: any) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name}
                              </option>
                            ))}
                          </SelectField>
                        </div>
                      )}

                      {roleNeedsClassSection(row.role_type) && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
                          <SelectField
                            value={row.section_id}
                            onChange={(e) => updateRoleAssignmentRow(index, 'section_id', e.target.value)}
                            className="select-field"
                            disabled={!row.class_id}
                          >
                            <option value="">Select section</option>
                            {allSectionsForRoles
                              ?.filter((sec: any) => String(sec.class_id) === String(row.class_id))
                              .map((sec: any) => (
                                <option key={sec.id} value={sec.id}>
                                  {sec.name}
                                </option>
                              ))}
                          </SelectField>
                        </div>
                      )}

                      {roleNeedsSubject(row.role_type) && (
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                          <SelectField
                            value={row.subject_id}
                            onChange={(e) => updateRoleAssignmentRow(index, 'subject_id', e.target.value)}
                            className="select-field"
                          >
                            <option value="">Select subject</option>
                            {subjects?.map((subject: any) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name}
                              </option>
                            ))}
                          </SelectField>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={row.remarks}
                          onChange={(e) => updateRoleAssignmentRow(index, 'remarks', e.target.value)}
                          placeholder="Optional"
                          className="input-field"
                        />
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() => removeRoleAssignmentRow(index)}
                          className="w-full px-3 py-2 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveTeacherRoles}
                      disabled={assignTeacherRolesMutation.isLoading}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {assignTeacherRolesMutation.isLoading ? 'Saving...' : 'Save Role Assignments'}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-md font-semibold text-slate-900 mb-1">
                    {selectedTeacherAssignments.length > 0 ? 'Edit assigned roles' : 'Assigned roles'}{' '}
                    for{' '}
                    {teachers?.find((t: any) => String(t.id) === selectedTeacherForRoles)?.name || 'Teacher'}
                  </h3>
                  {selectedTeacherAssignments.length > 0 && (
                    <p className="text-xs text-slate-500 mb-3">
                      Remove roles below or add new ones above. Roles synced from Sections/Subjects can also be edited here.
                    </p>
                  )}
                  {selectedTeacherAssignments.length > 0 && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-medium text-emerald-800 mb-1">Unlocked features for this teacher</p>
                      <div className="flex flex-wrap gap-1">
                        {featuresForRoleTypes(
                          [...new Set(selectedTeacherAssignments.map((a: any) => a.role_type))]
                        ).map((feature) => (
                          <span
                            key={feature}
                            className="inline-flex px-2 py-0.5 text-xs rounded-full bg-white border border-emerald-200 text-emerald-800 capitalize"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTeacherAssignments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Class</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Section</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Subject</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Remarks</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedTeacherAssignments.map((assignment: any) => (
                            <tr key={assignment.id} className="hover:bg-slate-50">
                              <td className="px-3 py-2 text-sm font-medium text-slate-900">{assignment.role_type}</td>
                              <td className="px-3 py-2 text-sm text-slate-600">{assignment.class_name || '—'}</td>
                              <td className="px-3 py-2 text-sm text-slate-600">{assignment.section_name || '—'}</td>
                              <td className="px-3 py-2 text-sm text-slate-600">{assignment.subject_name || '—'}</td>
                              <td className="px-3 py-2 text-sm text-slate-600">{assignment.remarks || '—'}</td>
                              <td className="px-3 py-2 text-sm">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTeacherRole(assignment)}
                                  className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-xs font-medium"
                                  title="Remove role"
                                >
                                  <span aria-hidden>🗑️</span>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No roles assigned to this teacher yet.</p>
                  )}
                </div>
              </>
            )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Billing / Invoice Template Tab */}
      {masterTab === 'billing' && schoolId && token && (
        <BillingInvoiceTab schoolId={schoolId} token={token} />
      )}

      {masterTab === 'coupon' && schoolId && token && (
        <CouponTab schoolId={schoolId} token={token} />
      )}

      {masterTab === 'expenses' && schoolId && token && (
        <ExpensesMasterTab schoolId={Number(schoolId)} token={token} />
      )}

      {masterTab === 'assets' && schoolId && token && (
        <AssetsMasterTab schoolId={Number(schoolId)} token={token} />
      )}

      {masterTab === 'ex-payments' && schoolId && token && (
        <ExtraPaymentsMasterTab schoolId={Number(schoolId)} token={token} />
      )}

      {masterTab === 'leave' && schoolId && token && academicYear?.id && (
        <LeaveMasterTab
          schoolId={Number(schoolId)}
          academicYearId={Number(academicYear.id)}
          academicYearLabel={academicYear.name}
          token={token}
        />
      )}

      {masterTab === 'leave' && schoolId && token && !academicYear?.id && (
        <MasterDataTabShell title="Leave Types" subtitle="Academic year required">
          <div className="flex-1 flex items-center justify-center text-xs text-amber-200/90 py-8 px-4 text-center">
            Select an academic year from the sidebar to configure leave types.
          </div>
        </MasterDataTabShell>
      )}

      {masterTab === 'exam-types' && schoolId && token && (
        <ExamTypesMasterTab schoolId={Number(schoolId)} token={token} />
      )}

      {/* ID Format Tab */}
      {masterTab === 'id' && (
        <>
          <MasterDataTabShell
            title="ID Formats"
            subtitle={`${branchLabel}${academicYear?.name ? ` · ${academicYear.name}` : ''}`}
            toolbarActions={
              !idFormatEditing ? (
                <MasterDataToolbarBtn
                  disabled={isAllBranches || !academicYear?.id}
                  onClick={() => {
                    const row = allIdFormatSettings?.find((r: any) => r.id_type === selectedIdType)
                    if (row) loadIdFormatFromRow(row, selectedIdType)
                    setIdFormatEditing(true)
                  }}
                >
                  Edit Format
                </MasterDataToolbarBtn>
              ) : undefined
            }
            footer={
              allIdFormatSettings?.length
                ? `Showing ${allIdFormatSettings.length} records`
                : undefined
            }
          >
            {idFormatSaveNotice ? (
              <div className="master-data-tab-banner text-emerald-200/90 shrink-0">{idFormatSaveNotice}</div>
            ) : null}
            {isAllBranches ? (
              <div className="master-data-tab-banner text-amber-200/90 shrink-0">
                Select a specific branch from the top bar to view and edit ID formats.
              </div>
            ) : null}
            {!schoolId ? (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Select a school to load ID configuration.</div>
            ) : !academicYear?.id ? (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Select an academic year to load ID configuration.</div>
            ) : isAllBranches ? (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Select a specific branch to load ID configuration.</div>
            ) : allIdFormatSettingsLoading ? (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
            ) : allIdFormatSettingsError ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
                <p className="text-xs text-red-300">
                  {(allIdFormatSettingsErrorDetail as any)?.response?.data?.error || 'Failed to load ID configuration.'}
                </p>
                <button type="button" onClick={() => refetchAllIdFormatSettings()} className="md-action-link md-action-edit">Retry</button>
              </div>
            ) : allIdFormatSettings?.length ? (
              <MasterDataDenseTable>
                <table className="data-table data-table-fit w-full">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Template</th>
                      <th>Prefix</th>
                      <th className="text-center">Pad</th>
                      <th className="text-center">Seq</th>
                      <th className="text-center">Yr</th>
                      <th>Preview</th>
                      <th>Updated</th>
                      <th className="text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {allIdFormatSettings.map((row: any) => (
                      <tr key={row.id_type} className="master-data-table-row hover:bg-white/[0.04]">
                        <td className="max-w-0"><span className="md-cell-text font-medium text-white">{row.label || getIdFormatTypeMeta(row.id_type).label}</span></td>
                        <td className="max-w-0"><span className="md-cell-text font-mono text-[10px]">{row.format_template}</span></td>
                        <td className="max-w-0"><span className="md-cell-text">{row.prefix}</span></td>
                        <td className="text-center tabular-nums">{row.sequence_padding}</td>
                        <td className="text-center tabular-nums">{row.next_sequence}</td>
                        <td className="text-center text-[10px]">{row.reset_sequence_yearly ? 'Y' : 'N'}</td>
                        <td className="max-w-0"><span className="md-cell-text font-mono text-emerald-300/90">{row.preview_id || row.preview_employee_id || '—'}</span></td>
                        <td className="whitespace-nowrap text-[10px] text-white/50 tabular-nums">{formatIdSettingsUpdatedAt(row.updated_at)}</td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const idType = row.id_type as IdFormatType
                              setSelectedIdType(idType)
                              loadIdFormatFromRow(row, idType)
                              setIdFormatEditing(true)
                            }}
                            className="md-action-link md-action-edit"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MasterDataDenseTable>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
                No ID formats configured. Click Edit Format to set up employee and admission IDs.
              </div>
            )}
          </MasterDataTabShell>

          {idFormatEditing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
              <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="modal-title">
                Edit {getIdFormatTypeMeta(selectedIdType).label} Format
              </h3>
              <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-white/15 bg-black/30 p-1">
                {ID_FORMAT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedIdType(type.id)
                      const row = allIdFormatSettings?.find((r: any) => r.id_type === type.id)
                      if (row) {
                        loadIdFormatFromRow(row, type.id)
                      } else {
                        setIdFormatFormsByType((prev) => ({
                          ...prev,
                          [type.id]: buildDefaultIdFormatForm(type.id),
                        }))
                        setIdFormatPreviewsByType((prev) => ({ ...prev, [type.id]: '' }))
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                      selectedIdType === type.id
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-white/65 hover:bg-white/10'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-white/55 -mt-2">{getIdFormatTypeMeta(selectedIdType).description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-text">ID Format Template <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  value={idFormatForm.format_template}
                  onChange={(e) => patchIdFormatForm(selectedIdType, { format_template: e.target.value })}
                  className="input-field font-mono text-sm"
                  placeholder={getIdFormatTypeMeta(selectedIdType).defaultTemplate}
                />
                <p className="text-xs text-slate-500 mt-1">Must include {'{SEQ}'} or {'{SEQ:n}'} for numbering.</p>
              </div>
              <div>
                <label className="label-text">Prefix <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  value={idFormatForm.prefix}
                  onChange={(e) => patchIdFormatForm(selectedIdType, { prefix: e.target.value.toUpperCase() })}
                  className="input-field"
                  placeholder={getIdFormatTypeMeta(selectedIdType).defaultPrefix}
                />
              </div>
              <div>
                <label className="label-text">Default Sequence Padding</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={idFormatForm.sequence_padding}
                  onChange={(e) => patchIdFormatForm(selectedIdType, { sequence_padding: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Next Sequence Number</label>
                <input
                  type="number"
                  min={1}
                  value={idFormatForm.next_sequence}
                  onChange={(e) => patchIdFormatForm(selectedIdType, { next_sequence: e.target.value })}
                  className="input-field"
                />
                <p className="text-xs text-slate-500 mt-1">Adjust only if you need to skip or reset numbering.</p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={idFormatForm.reset_sequence_yearly}
                onChange={(e) =>
                  patchIdFormatForm(selectedIdType, { reset_sequence_yearly: e.target.checked })
                }
                className="rounded border-slate-300"
              />
              Reset sequence to 1 at the start of each academic year
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-600 mb-2">Available tokens</p>
              <div className="flex flex-wrap gap-2">
                {EMPLOYEE_ID_TOKENS.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    title={item.description}
                    onClick={() =>
                      patchIdFormatForm(selectedIdType, {
                        format_template: `${idFormatForm.format_template}${item.token}`,
                      })
                    }
                    className="px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded hover:bg-primary-50 hover:border-primary-300"
                  >
                    {item.token}
                  </button>
                ))}
              </div>
              <ul className="mt-3 space-y-1">
                {EMPLOYEE_ID_TOKENS.map((item) => (
                  <li key={`${item.token}-help`} className="text-xs text-slate-500">
                    <span className="font-mono text-slate-700">{item.token}</span> — {item.description}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
              <p className="text-xs font-medium text-primary-800 mb-1">Next {getIdFormatTypeMeta(selectedIdType).label} preview</p>
              <p className="text-lg font-semibold font-mono text-primary-900">
                {idFormatPreview || '—'}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  refetchAllIdFormatSettings()
                  setIdFormatEditing(false)
                }}
                className="btn-secondary btn-compact"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveIdFormatSettingsMutation.isLoading}
                onClick={() => {
                  const form = idFormatFormsByType[selectedIdType]
                  saveIdFormatSettingsMutation.mutate({
                    idType: selectedIdType,
                    format_template: form.format_template.trim(),
                    prefix: form.prefix.trim(),
                    sequence_padding: Number(form.sequence_padding),
                    next_sequence: Number(form.next_sequence),
                    reset_sequence_yearly: form.reset_sequence_yearly,
                  })
                }}
                className="btn-primary btn-compact disabled:opacity-50"
              >
                {saveIdFormatSettingsMutation.isLoading ? 'Saving...' : 'Save Format'}
              </button>
            </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Face Registration Tab */}
      {masterTab === 'face-registration' && (
        <FaceRegistrationPanel
          teachers={teachers || []}
          scopedHeaders={scopedHeaders}
          branchScopeKey={branchScopeKey}
          academicYearId={academicYear?.id || 0}
          schoolId={schoolId}
          isActive={masterTab === 'face-registration'}
          requireBranchForWrite={requireBranchForWrite}
        />
      )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
