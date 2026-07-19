'use client'

import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import AppModal from '@/components/AppModal'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useTeacherDuty } from '@/contexts/TeacherDutyContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useMemo } from 'react'
import { downloadStudentImportTemplate } from '@/lib/studentImportTemplate'
import { getStudentPhotoUrl, getStudentInitials, validateStudentPhotoFile } from '@/lib/studentPhoto'
import { invalidateFinanceQueries } from '@/lib/invalidateFinanceQueries'
import { lockModalScroll, unlockModalScroll } from '@/lib/modalScrollLock'
import { getApiUrl } from '@/lib/api'
import EmailOtpVerify from '@/components/EmailOtpVerify'
import { useOtpEnforced } from '@/lib/useOtpEnforced'
import { formatClassTeacherScopeLabel } from '@/lib/classTeacherScope'
import { canManageStudents, canDeleteStudents } from '@/lib/rolePermissions'
import PreschoolAdmissionFormFields from '@/components/students/PreschoolAdmissionFormFields'
import {
  PreschoolAdmissionData,
  defaultPreschoolAdmissionData,
  buildPreschoolSubmitPayload,
  mergeStudentIntoPreschoolData,
  formatAgeLabelFromDob,
  matchClassIdForEnrollment,
  EnrollmentLevel,
} from '@/lib/preschoolAdmissionForm'
import { isPreschoolContext } from '@/lib/isPreschool'
import { useToday } from '@/lib/useToday'
import DocumentUploadField from '@/components/students/DocumentUploadField'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterBadge,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import {
  StudentDocumentType,
  StudentDocumentsState,
  STUDENT_DOCUMENT_LABELS,
  STUDENT_DOCUMENT_TYPES,
  createEmptyDocumentsState,
  documentsFromStudent,
  revokeDocumentPreviews,
  getStudentDocumentUrl,
} from '@/lib/studentDocuments'

function StudentAvatar({
  student,
  size = 'md',
}: {
  student: { first_name?: string; last_name?: string; photo_url?: string | null }
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const photoSrc = getStudentPhotoUrl(student?.photo_url)
  const sizeClasses = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-14 h-14 text-base',
    lg: 'w-28 h-28 text-2xl',
  }
  const cls = sizeClasses[size]

  if (photoSrc) {
    return (
      <img
        src={photoSrc}
        alt=""
        className={`${cls} rounded-full object-cover border border-white/20 bg-white/10`}
      />
    )
  }

  return (
    <div
      className={`${cls} rounded-full bg-indigo-500/25 text-indigo-100 font-semibold flex items-center justify-center border border-indigo-300/30 shrink-0`}
    >
      {getStudentInitials(student?.first_name, student?.last_name)}
    </div>
  )
}

function resolveStudentMobile(student: {
  phone?: string | null
  father_phone?: string | null
  mother_phone?: string | null
}) {
  return String(student.phone || student.father_phone || student.mother_phone || '').trim()
}

function formatAdmissionDisplay(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
}

function ViewDetailField({
  label,
  value,
  className = '',
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-white/10 bg-black/20 px-4 py-3 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-white/55 mb-1">{label}</p>
      <div className="text-sm text-white/95 break-words">{value || '—'}</div>
    </div>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="h-4 w-1 rounded-full bg-amber-400/90" aria-hidden />
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white/90">{title}</h4>
        </div>
        {description && <p className="meta-text mt-1.5 ml-3.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const fieldErrorClass = (hasError: boolean) =>
  hasError ? 'border-red-400/70 focus:ring-red-400/30' : ''

const resolveParentLoginFields = (student: any) => {
  if (student?.parent_account?.email) {
    return {
      parent_type: student.parent_account.parent_type || 'father',
      parent_login_email: student.parent_account.email || '',
      parent_login_password: '',
    }
  }
  if (student?.father_email) {
    return { parent_type: 'father', parent_login_email: student.father_email, parent_login_password: '' }
  }
  if (student?.mother_email) {
    return { parent_type: 'mother', parent_login_email: student.mother_email, parent_login_password: '' }
  }
  if (student?.guardian_email) {
    return { parent_type: 'guardian', parent_login_email: student.guardian_email, parent_login_password: '' }
  }
  return { parent_type: 'father', parent_login_email: '', parent_login_password: '' }
}

export default function StudentsPage() {
  const { user, token } = useAuth()
  const { classTeacherScopes, isClassTeacher, isLoading: dutyLoading, refetch: refetchTeacherDuty } =
    useTeacherDuty()
  const isTeacher = user?.role_name === 'Teacher'
  const canEditStudent = canManageStudents(user?.role_name)
  const canDeleteStudent = canDeleteStudents(user?.role_name)
  const { academicYear, academicYears } = useAcademicYear()
  const { branch, branches, isAllBranches, branchScopeKey, scopedHeaders, requireBranchForWrite, branchLabel } =
    useBranchYearScope()
  const canManageBranchStudents = !isAllBranches && !!branch?.id
  const queryClient = useQueryClient()
  const otpEnforced = useOtpEnforced()
  const [showForm, setShowForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<any>(null)
  const [viewingStudent, setViewingStudent] = useState<any>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClassIds, setFilterClassIds] = useState<string[]>([])
  const [filterSectionIds, setFilterSectionIds] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importAcademicYearId, setImportAcademicYearId] = useState<string>('')
  const [importClassId, setImportClassId] = useState<string>('')
  const [importSectionId, setImportSectionId] = useState<string>('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState<string>('')
  const [admissionNumberPreview, setAdmissionNumberPreview] = useState('')
  const [loadingAdmissionNumberPreview, setLoadingAdmissionNumberPreview] = useState(false)
  const [manualAdmissionNumber, setManualAdmissionNumber] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!showImportModal && !viewingStudent) return
    lockModalScroll()
    return () => unlockModalScroll()
  }, [showImportModal, viewingStudent])
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [preschoolData, setPreschoolData] = useState<PreschoolAdmissionData>(defaultPreschoolAdmissionData())
  const [middleName, setMiddleName] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [placeOfBirth, setPlaceOfBirth] = useState('')
  const [parentEmailVerificationToken, setParentEmailVerificationToken] = useState('')
  const [documents, setDocuments] = useState<StudentDocumentsState>(createEmptyDocumentsState)

  const [formData, setFormData] = useState({
    // Personal Information
    admission_number: '',
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Parent Information
    father_name: '',
    father_phone: '',
    mother_name: '',
    mother_phone: '',
    // Academic Information
    class_id: '',
    section_id: '',
    roll_number: '',
    status: 'Active',
    parent_type: 'father',
    parent_login_email: '',
    parent_login_password: '',
  })

  // Fetch classes
  const { data: classes } = useQuery(
    ['classes', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${getApiUrl()}/classes`, {
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

  const isPreschool = isPreschoolContext({
    branch,
    branches,
    classes,
    isAllBranches,
  })

  const today = useToday()
  const preschoolAgeLabel = useMemo(
    () => (isPreschool ? formatAgeLabelFromDob(formData.date_of_birth, today) : ''),
    [isPreschool, formData.date_of_birth, today]
  )

  // Fetch sections based on selected class (for form)
  const { data: sections } = useQuery(
    ['sections', selectedClassId, academicYear?.id],
    async () => {
      if (!selectedClassId) return []
      const response = await axios.get(`${getApiUrl()}/sections`, {
        params: {
          class_id: selectedClassId,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!selectedClassId && !!academicYear }
  )

  // Fetch classes for import modal (based on importAcademicYearId)
  const { data: importClasses } = useQuery(
    ['classes', user?.school_id, importAcademicYearId, branchScopeKey, 'import'],
    async () => {
      const response = await axios.get(`${getApiUrl()}/classes`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: importAcademicYearId,
        },
        headers: {
          ...scopedHeaders,
          'academic-year-id': String(importAcademicYearId),
        },
      })
      return response.data.data
    },
    { enabled: !!user && !!importAcademicYearId }
  )

  // Fetch sections for import modal (based on importClassId + importAcademicYearId)
  const { data: importSections } = useQuery(
    ['sections', importClassId, importAcademicYearId, 'import'],
    async () => {
      if (!importClassId) return []
      const response = await axios.get(`${getApiUrl()}/sections`, {
        params: {
          class_id: importClassId,
          school_id: user?.school_id,
          academic_year_id: importAcademicYearId,
        },
        headers: {
          ...scopedHeaders,
          'academic-year-id': String(importAcademicYearId),
        },
      })
      return response.data.data
    },
    { enabled: !!importClassId && !!importAcademicYearId }
  )

  // Fetch sections for filter (based on selected classes)
  const { data: filterSections } = useQuery(
    ['sections', filterClassIds.join(','), academicYear?.id, 'filter'],
    async () => {
      if (!filterClassIds.length) return []
      const responses = await Promise.all(
        filterClassIds.map((classId) =>
          axios.get(`${getApiUrl()}/sections`, {
            params: {
              class_id: classId,
              school_id: user?.school_id,
              academic_year_id: academicYear?.id,
            },
            headers: scopedHeaders,
          })
        )
      )
      const merged = new Map<number, { id: number; name: string; class_id?: number }>()
      responses.forEach((response) => {
        ;(response.data.data || []).forEach((section: { id: number; name: string; class_id?: number }) => {
          merged.set(section.id, section)
        })
      })
      return Array.from(merged.values())
    },
    { enabled: filterClassIds.length > 0 && !!academicYear }
  )

  const statusFilterOptions = useMemo(
    () => [
      { value: 'Active', label: 'Active' },
      { value: 'Inactive', label: 'Inactive' },
      { value: 'Dropped', label: 'Dropped' },
    ],
    []
  )

  const classTeacherLabel = formatClassTeacherScopeLabel(classTeacherScopes)

  useEffect(() => {
    if (isTeacher && academicYear?.id) {
      refetchTeacherDuty()
    }
  }, [isTeacher, academicYear?.id, refetchTeacherDuty])

  const { data: studentsResponse, refetch, isLoading: studentsLoading } = useQuery(
    ['students', user?.school_id, academicYear?.id, branch?.id, isAllBranches, isTeacher, classTeacherScopes.length],
    async () => {
      const response = await axios.get(`${getApiUrl()}/students`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      enabled: !!user && !!academicYear && (!isTeacher || (!dutyLoading && isClassTeacher)),
    }
  )

  const students = studentsResponse?.data
  const serverClassTeacher =
    isTeacher && studentsResponse?.is_class_teacher !== undefined
      ? !!studentsResponse.is_class_teacher
      : isClassTeacher
  const showStudentsAsClassTeacher = isTeacher ? serverClassTeacher && isClassTeacher : true

  // Filter and search students
  const filteredStudents = students?.filter((student: any) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesSearch = 
        student.admission_number?.toLowerCase().includes(searchLower) ||
        student.first_name?.toLowerCase().includes(searchLower) ||
        student.last_name?.toLowerCase().includes(searchLower) ||
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchLower) ||
        student.phone?.toLowerCase().includes(searchLower) ||
        student.father_phone?.toLowerCase().includes(searchLower) ||
        student.mother_phone?.toLowerCase().includes(searchLower)
      
      if (!matchesSearch) return false
    }

    // Class / section filters (admins only — teachers are scoped on the server)
    if (!isTeacher) {
      if (filterClassIds.length > 0 && !filterClassIds.includes(String(student.class_id))) {
        return false
      }
      if (filterSectionIds.length > 0 && !filterSectionIds.includes(String(student.section_id))) {
        return false
      }
    }

    // Status filter
    if (
      filterStatuses.length > 0 &&
      !filterStatuses.some((s) => student.status?.toLowerCase() === s.toLowerCase())
    ) {
      return false
    }

    return true
  }) || []

  const resetImportModal = () => {
    setShowImportModal(false)
    setImportAcademicYearId('')
    setImportClassId('')
    setImportSectionId('')
    setImportFile(null)
    setImportProgress('')
  }

  const openImportModal = () => {
    if (!canManageBranchStudents) {
      alert('Select a specific branch from the top bar before importing students.')
      return
    }
    setImportAcademicYearId(academicYear?.id ? String(academicYear.id) : '')
    setImportClassId('')
    setImportSectionId('')
    setImportFile(null)
    setImportProgress('')
    setShowImportModal(true)
  }

  const selectedImportAcademicYear = academicYears.find(
    (y) => String(y.id) === importAcademicYearId
  )
  const selectedImportClass = importClasses?.find((c: { id: number }) => String(c.id) === importClassId)
  const selectedImportSection = importSections?.find((s: { id: number }) => String(s.id) === importSectionId)
  const importTargetReady =
    canManageBranchStudents && !!importAcademicYearId && !!importClassId && !!importSectionId

  const fetchAdmissionNumberPreview = async () => {
    if (!user?.school_id || !token) return
    setLoadingAdmissionNumberPreview(true)
    try {
      const response = await axios.get(`${getApiUrl()}/employee-id-settings/preview`, {
        params: {
          school_id: user.school_id,
          academic_year_id: academicYear?.id,
          id_type: 'student',
        },
        headers: scopedHeaders,
      })
      setAdmissionNumberPreview(response.data.data?.generated_id || '')
    } catch {
      setAdmissionNumberPreview('')
    } finally {
      setLoadingAdmissionNumberPreview(false)
    }
  }

  useEffect(() => {
    if (showForm && !manualAdmissionNumber && !editingStudent) {
      fetchAdmissionNumberPreview()
    }
  }, [showForm, manualAdmissionNumber, editingStudent, user?.school_id, academicYear?.id, token])

  const importMutation = useMutation(
    async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('school_id', String(user?.school_id || ''))
      formData.append('academic_year_id', importAcademicYearId)
      formData.append('class_id', importClassId)
      formData.append('section_id', importSectionId)
      if (branch?.id) {
        formData.append('branch_id', String(branch.id))
      }

      const response = await axios.post(
        `${getApiUrl()}/students/import`,
        formData,
        {
          headers: {
            ...scopedHeaders,
            'academic-year-id': String(importAcademicYearId),
          },
          timeout: 120000,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              if (percentCompleted >= 100) {
                setImportProgress('Processing students on server...')
              } else {
                setImportProgress(`Uploading: ${percentCompleted}%`)
              }
            }
          },
        }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        const count = data?.success_count ?? 0
        const errorDetails =
          data?.errors?.length > 0
            ? `\n\n${data.errors.slice(0, 3).map((e: { error?: string }) => e.error).filter(Boolean).join('\n')}`
            : ''

        if (!data?.success || count === 0) {
          alert(`${data?.message || 'Import failed.'}${errorDetails}`)
          return
        }

        const feeCount = data?.fee_structures_created ?? 0
        const errorMsg = data?.errors?.length > 0 ? ` ${data.errors.length} row(s) had errors.` : ''
        const feeMsg =
          feeCount > 0 ? ` ${feeCount} fee structure(s) were created automatically.` : ''
        alert(
          data?.message ||
            `Import successful! ${count} students imported.${feeMsg}${errorMsg}`
        )
        queryClient.invalidateQueries(['students', user?.school_id, importAcademicYearId, branch?.id])
        invalidateFinanceQueries(queryClient, user?.school_id, Number(importAcademicYearId))
        if (importAcademicYearId === String(academicYear?.id || '')) {
          queryClient.invalidateQueries([
            'students',
            user?.school_id,
            academicYear?.id,
            branch?.id,
            isAllBranches,
          ])
          refetch()
        }
        resetImportModal()
      },
      onError: (error: any) => {
        console.error('Import error:', error)
        const details = error.response?.data?.details
        const rowErrors = error.response?.data?.errors
        const rowErrorText =
          Array.isArray(rowErrors) && rowErrors.length > 0
            ? `\n\n${rowErrors.slice(0, 3).map((e: { error?: string }) => e.error).join('\n')}`
            : ''
        const errorMessage =
          error.code === 'ECONNABORTED'
            ? 'Import timed out. Some students may have been saved—refresh the list and try again if needed.'
            : error.response?.data?.error ||
              error.response?.data?.message ||
              details ||
              error.message ||
              'Failed to import students'
        alert(`${errorMessage}${rowErrorText}`)
      },
      onSettled: () => {
        setImportProgress('')
      },
    }
  )

  const clearPhotoState = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    setExistingPhotoUrl(null)
    setRemovePhoto(false)
  }

  const uploadStudentPhotoAfterCreate = async (studentId: number) => {
    if (!photoFile) return
    const formDataPhoto = new FormData()
    formDataPhoto.append('photo', photoFile)
    formDataPhoto.append('school_id', String(user?.school_id || ''))
    await axios.post(`${getApiUrl()}/students/${studentId}/photo`, formDataPhoto, {
      headers: scopedHeaders,
    })
  }

  const handleDocumentFileSelect = (type: StudentDocumentType, file: File) => {
    setDocuments((prev) => {
      const slot = prev[type]
      if (slot.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(slot.previewUrl)
      }
      return {
        ...prev,
        [type]: {
          file,
          previewUrl: URL.createObjectURL(file),
          existingUrl: slot.existingUrl,
          remove: false,
        },
      }
    })
  }

  const handleDocumentRemove = (type: StudentDocumentType) => {
    setDocuments((prev) => {
      const slot = prev[type]
      if (slot.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(slot.previewUrl)
      }
      return {
        ...prev,
        [type]: {
          file: null,
          previewUrl: null,
          existingUrl: slot.existingUrl,
          remove: !!(slot.existingUrl || slot.file),
        },
      }
    })
  }

  const uploadPendingDocuments = async (studentId: number) => {
    const headers = scopedHeaders

    for (const type of STUDENT_DOCUMENT_TYPES) {
      const slot = documents[type]
      if (slot.remove && slot.existingUrl) {
        await axios.delete(`${getApiUrl()}/students/${studentId}/documents/${type}`, {
          params: { school_id: user?.school_id },
          headers,
        })
      } else if (slot.file) {
        const fd = new FormData()
        fd.append('document', slot.file)
        fd.append('document_type', type)
        fd.append('school_id', String(user?.school_id || ''))
        await axios.post(`${getApiUrl()}/students/${studentId}/documents`, fd, { headers })
      }
    }
  }

  const hasPendingDocuments = STUDENT_DOCUMENT_TYPES.some((type) => {
    const slot = documents[type]
    return !!slot.file || (slot.remove && !!slot.existingUrl)
  })

  const buildFormDataPayload = (payload: Record<string, unknown>) => {
    const fd = new FormData()
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        fd.append(key, String(value))
      }
    })
    if (photoFile) {
      fd.append('photo', photoFile)
    }
    if (removePhoto) {
      fd.append('remove_photo', 'true')
    }
    return fd
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const photoError = validateStudentPhotoFile(file)
    if (photoError) {
      alert(photoError)
      e.target.value = ''
      return
    }
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
    e.target.value = ''
  }

  const handleRemovePhotoClick = () => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    setRemovePhoto(true)
  }

  const buildStudentPayload = (data: Record<string, unknown>) => {
    const payload: Record<string, unknown> = {
      ...data,
      school_id: user?.school_id,
      academic_year_id: academicYear?.id,
    }
    if (payload.class_id) payload.class_id = Number(payload.class_id)
    if (payload.section_id) payload.section_id = Number(payload.section_id)
    if (!String(payload.parent_login_password || '').trim()) {
      delete payload.parent_login_password
    }
    return payload
  }

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const payload = buildStudentPayload(data)
      const headers = scopedHeaders
      const url = `${getApiUrl()}/students/${id}/update`
      const useMultipart = !!(photoFile || removePhoto)

      if (useMultipart) {
        const response = await axios.post(url, buildFormDataPayload(payload), { headers })
        return response.data
      }

      const response = await axios.post(url, payload, { headers })
      return response.data
    },
    {
      onSuccess: async (_data, variables) => {
        try {
          if (isPreschool && hasPendingDocuments) {
            await uploadPendingDocuments(variables.id)
          }
        } catch (docErr: any) {
          console.error('Document upload error:', docErr)
          alert(
            docErr.response?.data?.error ||
              'Student updated, but some documents could not be saved. Edit the student to retry.'
          )
        }
        queryClient.invalidateQueries(['students', user?.school_id, academicYear?.id])
        refetch()
        closeForm()
        alert('Student updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update student error:', error)
        const status = error.response?.status
        const serverError = error.response?.data?.error
        if (status === 404) {
          alert(
            'Save failed: server route not found. Restart the API server (npm run dev in the server folder), then try again.'
          )
          return
        }
        if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
          const validationErrors: Record<string, string> = {}
          error.response.data.errors.forEach((err: any) => {
            const field = err.param || err.path || err.field
            if (field) validationErrors[field] = err.msg || err.message || 'Invalid value'
          })
          setErrors(validationErrors)
          return
        }
        const errorMessage = serverError || error.message || 'Failed to update student'
        if (errorMessage.toLowerCase().includes('admission number')) {
          setErrors({ admission_number: errorMessage })
          setTouched((prev) => ({ ...prev, admission_number: true }))
        } else {
          alert(errorMessage)
        }
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${getApiUrl()}/students/${id}`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        setViewingStudent(null)
        queryClient.invalidateQueries(['students', user?.school_id, academicYear?.id])
        refetch()
        alert('Student removed successfully!')
      },
      onError: (error: any) => {
        console.error('Delete student error:', error)
        alert(error.response?.data?.error || error.message || 'Failed to remove student')
      },
    }
  )

  const createMutation = useMutation(
    async (data: any) => {
      const payload: Record<string, unknown> = {
        ...data,
        school_id: user?.school_id,
        academic_year_id: academicYear?.id,
      }
      if (!String(payload.admission_number || '').trim()) {
        delete payload.admission_number
      }
      const response = await axios.post(
        `${getApiUrl()}/students`,
        payload,
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: async (data: any) => {
        const studentId = Number(data?.data?.id)
        try {
          if (studentId && photoFile) {
            await uploadStudentPhotoAfterCreate(studentId)
          }
        } catch (photoErr: any) {
          console.error('Photo upload error:', photoErr)
          alert(
            photoErr.response?.data?.error ||
              'Student added, but the profile photo could not be uploaded. Edit the student to add a photo.'
          )
        }
        try {
          if (studentId && isPreschool && hasPendingDocuments) {
            await uploadPendingDocuments(studentId)
          }
        } catch (docErr: any) {
          console.error('Document upload error:', docErr)
          alert(
            docErr.response?.data?.error ||
              'Student added, but some documents could not be uploaded. Edit the student to add documents.'
          )
        }
        queryClient.invalidateQueries(['students', user?.school_id, academicYear?.id])
        refetch()
        closeForm()
        alert('Student added successfully!')
      },
      onError: (error: any) => {
        console.error('Create student error:', error)
        
        // Handle validation errors from backend
        if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
          const validationErrors: Record<string, string> = {}
          error.response.data.errors.forEach((err: any) => {
            const field = err.param || err.path || err.field
            if (field) {
              validationErrors[field] = err.msg || err.message || 'Invalid value'
            }
          })
          setErrors(validationErrors)
          // Mark all error fields as touched
          const touchedFields: Record<string, boolean> = {}
          Object.keys(validationErrors).forEach(field => {
            touchedFields[field] = true
          })
          setTouched(prev => ({ ...prev, ...touchedFields }))
        } else {
          // Handle general errors
          const errorMessage = error.response?.data?.error || error.message || 'Failed to add student'
          
          // Check if it's a specific field error (e.g., "Admission number already exists")
          if (errorMessage.toLowerCase().includes('admission number')) {
            setErrors({ admission_number: errorMessage })
            setTouched(prev => ({ ...prev, admission_number: true }))
          } else {
            alert(errorMessage)
          }
        }
      },
    }
  )

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (manualAdmissionNumber && !formData.admission_number.trim()) {
      newErrors.admission_number = 'Admission number is required when entering manually'
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = isPreschool ? 'Name is required' : 'First name is required'
    }

    if (!formData.class_id) {
      newErrors.class_id = 'Class is required'
    }

    // Section validation: Only required if sections exist for the selected class
    if (formData.class_id) {
      if (sections && sections.length > 0) {
        // Sections exist - section selection is mandatory
        if (!formData.section_id) {
          newErrors.section_id = 'Section is required. Please select a section.'
        }
      } else if (sections && sections.length === 0 && selectedClassId) {
        // No sections exist for this class - show helpful message
        newErrors.section_id = 'No sections available for this class. Please create sections first.'
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (formData.parent_login_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.parent_login_email)) {
      newErrors.parent_login_email = 'Please enter a valid parent login email'
    }

    if (formData.parent_login_email) {
      if (!editingStudent && !formData.parent_login_password.trim()) {
        newErrors.parent_login_password = 'Password is required when setting up parent login'
      } else if (formData.parent_login_password && formData.parent_login_password.length < 6) {
        newErrors.parent_login_password = 'Password must be at least 6 characters'
      }
    } else if (formData.parent_login_password.trim()) {
      newErrors.parent_login_email = 'Parent login email is required when setting a password'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Mark all fields as touched
    const allFields = Object.keys(formData)
    const touchedFields: Record<string, boolean> = {}
    allFields.forEach(field => {
      touchedFields[field] = true
    })
    setTouched(touchedFields)

    if (!validateForm()) {
      return
    }
    
    if (!academicYear) {
      alert('Please select an academic year first.')
      return
    }

    if (!user?.school_id) {
      alert('School ID is required. Please ensure you are assigned to a school.')
      return
    }

    const submitData = isPreschool
      ? buildPreschoolSubmitPayload(formData, preschoolData, {
          middle_name: middleName,
          aadhaar_number: aadhaarNumber,
          place_of_birth: placeOfBirth,
        })
      : { ...formData }

    if (submitData.parent_login_email && !editingStudent) {
      if (otpEnforced && !parentEmailVerificationToken) {
        alert('Please verify the parent login email with OTP before saving.')
        return
      }
      if (otpEnforced && parentEmailVerificationToken) {
        submitData.parent_email_verification_token = parentEmailVerificationToken
      }
    }

    if (editingStudent) {
      const studentId = Number(editingStudent.id)
      if (!studentId || Number.isNaN(studentId)) {
        alert('Invalid student record. Please refresh the page and try again.')
        return
      }
      updateMutation.mutate({ id: studentId, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const getStudentDisplayName = (student: any) =>
    `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.admission_number || 'this student'

  const formatDisplayDate = (value: string | null | undefined) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString()
  }

  const formatStudentAge = (dateOfBirth: string | null | undefined) => {
    if (!dateOfBirth) return '—'
    const dob = String(dateOfBirth).slice(0, 10)
    return formatAgeLabelFromDob(dob, today) || '—'
  }

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Students',
      filename: 'students',
      getSubtitle: () => {
        const parts: string[] = []
        if (searchTerm.trim()) parts.push(`Search: ${searchTerm.trim()}`)
        if (filterClassIds.length) parts.push(`Class filter applied`)
        if (filterSectionIds.length) parts.push(`Section filter applied`)
        if (filterStatuses.length) parts.push(`Status: ${filterStatuses.join(', ')}`)
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'admission_number', label: 'Admission No.' },
        { key: 'name', label: 'Name' },
        { key: 'age', label: 'Age' },
        { key: 'father_name', label: 'Father Name' },
        { key: 'class_name', label: 'Class' },
        { key: 'section_name', label: 'Section' },
        { key: 'roll_number', label: 'Roll No.' },
        { key: 'status', label: 'Status' },
        { key: 'phone', label: 'Mobile' },
        { key: 'email', label: 'Email' },
      ],
      getRows: () =>
        filteredStudents.map((s: any) => ({
          admission_number: s.admission_number || '',
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
          age: formatStudentAge(s.date_of_birth),
          father_name: s.father_name || '',
          class_name: s.class_name || '',
          section_name: s.section_name || '',
          roll_number: s.roll_number || '',
          status: s.status || '',
          phone: resolveStudentMobile(s) || s.phone || '',
          email: s.email || '',
        })),
    },
  })

  const handleViewStudent = async (student: any) => {
    setViewingStudent(student)
    try {
      const response = await axios.get(`${getApiUrl()}/students/${student.id}`, {
        params: { academic_year_id: academicYear?.id },
        headers: scopedHeaders,
      })
      setViewingStudent({ ...student, ...response.data.data })
    } catch (error) {
      console.error('Failed to load student details:', error)
    }
  }

  const handleEditStudent = (student: any) => {
    const name = getStudentDisplayName(student)
    if (
      !window.confirm(
        `Edit student record for ${name}? You will be able to update their personal, parent, and academic details.`
      )
    ) {
      return
    }
    openEditStudent(student)
  }

  const openEditStudent = (student: any) => {
    setViewingStudent(null)
    setEditingStudent(student)
    setManualAdmissionNumber(true)
    setSelectedClassId(student.class_id ? Number(student.class_id) : null)
    setMiddleName(student.middle_name || '')
    setAadhaarNumber(student.aadhaar_number || '')
    setPlaceOfBirth(student.place_of_birth || '')
    setPreschoolData(mergeStudentIntoPreschoolData(student))
    revokeDocumentPreviews(documents)
    setDocuments(documentsFromStudent(student))
    setFormData({
      admission_number: student.admission_number || '',
      first_name: student.first_name || '',
      last_name: student.last_name || '',
      date_of_birth: student.date_of_birth ? String(student.date_of_birth).slice(0, 10) : '',
      gender: student.gender || '',
      email: student.email || '',
      phone: student.phone || '',
      address: student.address || '',
      city: student.city || '',
      state: student.state || '',
      pincode: student.pincode || '',
      father_name: student.father_name || '',
      father_phone: student.father_phone || '',
      mother_name: student.mother_name || '',
      mother_phone: student.mother_phone || '',
      class_id: student.class_id ? String(student.class_id) : '',
      section_id: student.section_id ? String(student.section_id) : '',
      roll_number: student.roll_number || '',
      status: student.status || 'Active',
      ...resolveParentLoginFields(student),
    })
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setRemovePhoto(false)
    setExistingPhotoUrl(student.photo_url || null)
    setPhotoPreview(getStudentPhotoUrl(student.photo_url))
    setErrors({})
    setTouched({})
    setShowForm(true)
  }

  const handleDeleteStudent = (student: any) => {
    const name = getStudentDisplayName(student)
    if (
      !window.confirm(
        `Are you sure you want to remove ${name}?\n\nThey will be marked as Dropped for ${academicYear?.name || 'this academic year'} and removed from the active student list. Section strength will be updated. This action cannot be undone from the table.`
      )
    ) {
      return
    }
    deleteMutation.mutate(student.id)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }

    // Validate email on change
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors(prev => ({
        ...prev,
        email: 'Please enter a valid email address'
      }))
    }

    // When class changes, reset section
    if (name === 'class_id') {
      setSelectedClassId(value ? Number(value) : null)
      setFormData(prev => ({
        ...prev,
        section_id: ''
      }))
      // Clear section error when class changes
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.section_id
        return newErrors
      })
    }
  }

  const handlePreschoolEnrollmentSelect = (level: EnrollmentLevel) => {
    const classId = matchClassIdForEnrollment(level, classes)
    if (!classId) return
    setSelectedClassId(Number(classId))
    setFormData((prev) => ({
      ...prev,
      class_id: classId,
      section_id: '',
    }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.class_id
      return next
    })
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Mark field as touched
    setTouched(prev => ({
      ...prev,
      [name]: true
    }))

    // Validate on blur
    if (name === 'admission_number' && manualAdmissionNumber && !value.trim()) {
      setErrors(prev => ({ ...prev, admission_number: 'Admission number is required when entering manually' }))
    } else if (name === 'first_name' && !value.trim()) {
      setErrors(prev => ({
        ...prev,
        first_name: isPreschool ? 'Name is required' : 'First name is required',
      }))
    } else if (name === 'class_id' && !value) {
      setErrors(prev => ({ ...prev, class_id: 'Class is required' }))
    } else if (name === 'section_id') {
      // Section validation based on whether sections exist
      if (sections && sections.length > 0 && !value) {
        setErrors(prev => ({ ...prev, section_id: 'Section is required. Please select a section.' }))
      } else if (sections && sections.length === 0 && selectedClassId) {
        setErrors(prev => ({ ...prev, section_id: 'No sections available for this class. Please create sections first.' }))
      }
    } else if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }))
    }
  }

  const clearFormState = () => {
    setEditingStudent(null)
    setManualAdmissionNumber(false)
    setAdmissionNumberPreview('')
    clearPhotoState()
    revokeDocumentPreviews(documents)
    setDocuments(createEmptyDocumentsState())
    setMiddleName('')
    setAadhaarNumber('')
    setPlaceOfBirth('')
    setPreschoolData(defaultPreschoolAdmissionData())
    setFormData({
      admission_number: '',
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      father_name: '',
      father_phone: '',
      mother_name: '',
      mother_phone: '',
      class_id: '',
      section_id: '',
      roll_number: '',
      status: 'Active',
      parent_type: 'father',
      parent_login_email: '',
      parent_login_password: '',
    })
    setSelectedClassId(null)
    setErrors({})
    setTouched({})
  }

  const closeForm = () => {
    clearFormState()
    setShowForm(false)
  }

  const openNewStudentForm = () => {
    clearFormState()
    setShowForm(true)
  }

  return (
    <Layout>
      <div className="flex flex-col page-container-viewport overflow-hidden gap-2">
        {isTeacher && !dutyLoading && !showStudentsAsClassTeacher && (
          <div className="alert-info shrink-0 py-2">
            <p className="text-xs">
              You are not assigned as a <span className="font-medium">Class Teacher</span> for any class and section
              this academic year. Ask your school admin to assign you in Master Data → Sections or Teacher roles.
            </p>
          </div>
        )}

        <AppModal
          open={showForm}
          onClose={closeForm}
          panelClassName={isPreschool ? 'max-w-6xl' : 'max-w-4xl'}
          labelledBy="student-form-title"
        >
              <div className="app-modal-header">
                <div>
                  <h2 id="student-form-title" className="modal-title">
                    {editingStudent
                      ? 'Edit Student'
                      : isPreschool
                        ? 'Preschool Application Form'
                        : 'Student Admission'}
                  </h2>
                  <p className="meta-text mt-1">
                    {editingStudent
                      ? isPreschool
                        ? 'Update preschool application and academic details.'
                        : 'Update personal, parent, and academic details.'
                      : isPreschool
                        ? 'Complete the official preschool admission application for this academic session.'
                        : 'Register a new student for the selected branch and academic year.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="app-modal-body">
                <form id="student-form" onSubmit={handleSubmit} className="space-y-7">
              {/* Profile Picture */}
              <FormSection title="Profile Photo">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-xl border border-white/10 bg-black/15 p-5">
                <div className="shrink-0">
                  {photoPreview && !removePhoto ? (
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-lg ring-2 ring-amber-400/30"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-amber-400/15 text-amber-200 text-xl font-semibold flex items-center justify-center border-4 border-white/20 shadow-lg ring-2 ring-amber-400/30">
                      {getStudentInitials(formData.first_name, formData.last_name)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="body-text">
                    Shown on the student profile, list, and parent portal.
                  </p>
                  <p className="meta-text mt-1">JPEG, PNG, GIF, or WebP — max 5 MB.</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                    <label className="btn-primary cursor-pointer text-sm py-2">
                      {photoPreview && !removePhoto ? 'Change photo' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                    {((photoPreview && !removePhoto) || existingPhotoUrl) && (
                      <button
                        type="button"
                        onClick={handleRemovePhotoClick}
                        className="btn-secondary text-sm py-2 text-red-200 border-red-400/30 hover:bg-red-500/10"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                  {removePhoto && existingPhotoUrl && (
                    <p className="text-xs text-amber-200/90 mt-2">
                      Photo will be removed when you save changes.
                    </p>
                  )}
                </div>
              </div>
              </FormSection>

              <div className="border-t border-white/10" />

              {isPreschool ? (
                <>
                  <FormSection title="Child Name & Identity">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                      <div>
                        <label htmlFor="last_name" className="label-text">Surname</label>
                        <input
                          type="text"
                          id="last_name"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label htmlFor="first_name" className="label-text">
                          Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          id="first_name"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                          className={`input-field ${fieldErrorClass(!!(touched.first_name && errors.first_name))}`}
                        />
                        {touched.first_name && errors.first_name && (
                          <p className="mt-1 text-sm text-red-300">{errors.first_name}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="date_of_birth" className="label-text">Date of Birth</label>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <input
                            type="date"
                            id="date_of_birth"
                            name="date_of_birth"
                            value={formData.date_of_birth}
                            onChange={handleChange}
                            className="input-field sm:max-w-xs"
                          />
                          {preschoolAgeLabel && (
                            <p className="text-sm font-medium text-amber-200/95 whitespace-nowrap">
                              Age: {preschoolAgeLabel}
                            </p>
                          )}
                        </div>
                        <div className="mt-3">
                          <DocumentUploadField
                            label={STUDENT_DOCUMENT_LABELS.dob_certificate}
                            description="Upload or photograph the student's birth certificate."
                            previewUrl={documents.dob_certificate.previewUrl}
                            hasExisting={!!documents.dob_certificate.existingUrl}
                            markedForRemoval={documents.dob_certificate.remove}
                            onFileSelect={(file) => handleDocumentFileSelect('dob_certificate', file)}
                            onRemove={() => handleDocumentRemove('dob_certificate')}
                            compact
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="gender" className="label-text">Gender</label>
                        <div className="flex gap-6 mt-2">
                          {(['Male', 'Female'] as const).map((g) => (
                            <label key={g} className="flex items-center gap-2 text-sm text-white/85">
                              <input
                                type="radio"
                                name="gender"
                                checked={formData.gender === g}
                                onChange={() => {
                                  setFormData((prev) => ({ ...prev, gender: g }))
                                  setTouched((prev) => ({ ...prev, gender: true }))
                                }}
                              />
                              {g}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </FormSection>

                  <div className="border-t border-white/10" />

                  <PreschoolAdmissionFormFields
                    data={preschoolData}
                    onChange={setPreschoolData}
                    middleName={middleName}
                    onMiddleNameChange={setMiddleName}
                    aadhaarNumber={aadhaarNumber}
                    onAadhaarChange={setAadhaarNumber}
                    placeOfBirth={placeOfBirth}
                    onPlaceOfBirthChange={setPlaceOfBirth}
                    academicYearName={academicYear?.name}
                    admissionNumberPreview={
                      manualAdmissionNumber
                        ? formData.admission_number
                        : loadingAdmissionNumberPreview
                          ? 'Loading...'
                          : admissionNumberPreview
                    }
                    errors={errors}
                    touched={touched}
                    onEnrollmentSelect={handlePreschoolEnrollmentSelect}
                    documents={documents}
                    onDocumentFileSelect={handleDocumentFileSelect}
                    onDocumentRemove={handleDocumentRemove}
                  />

                  <div className="border-t border-white/10" />
                </>
              ) : (
                <>
              {/* Personal Information Section */}
              <FormSection title="Personal Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="admission_number" className="label-text">
                      Admission Number
                    </label>
                    {manualAdmissionNumber ? (
                      <input
                        type="text"
                        id="admission_number"
                        name="admission_number"
                        value={formData.admission_number}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Enter admission number"
                        className={`input-field ${fieldErrorClass(!!(touched.admission_number && errors.admission_number))}`}
                      />
                    ) : (
                      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3">
                        <p className="text-xs font-medium text-amber-200 mb-1">Auto-generated on save</p>
                        <p className="text-base font-semibold font-mono text-white">
                          {loadingAdmissionNumberPreview
                            ? 'Loading preview...'
                            : admissionNumberPreview || 'Configure format in Master Data → ID'}
                        </p>
                      </div>
                    )}
                    {touched.admission_number && errors.admission_number && (
                      <p className="mt-1 text-sm text-red-300">{errors.admission_number}</p>
                    )}
                    {!editingStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualAdmissionNumber((prev) => !prev)
                          setFormData((f) => ({ ...f, admission_number: '' }))
                          setErrors((prev) => {
                            const next = { ...prev }
                            delete next.admission_number
                            return next
                          })
                          if (!manualAdmissionNumber) {
                            fetchAdmissionNumberPreview()
                          }
                        }}
                        className="mt-1 text-xs text-amber-300/90 hover:text-amber-200 underline-offset-2 hover:underline"
                      >
                        {manualAdmissionNumber
                          ? 'Use auto-generated admission number instead'
                          : 'Enter admission number manually'}
                      </button>
                    )}
                    {!manualAdmissionNumber && (
                      <p className="mt-1 text-xs text-white/50">
                        Format is configured in Master Data → ID → Admission Number.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="first_name" className="label-text">
                      First Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      className={`input-field ${fieldErrorClass(!!(touched.first_name && errors.first_name))}`}
                    />
                    {touched.first_name && errors.first_name && (
                      <p className="mt-1 text-sm text-red-300">{errors.first_name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="last_name" className="label-text">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="date_of_birth" className="label-text">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      id="date_of_birth"
                      name="date_of_birth"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="gender" className="label-text">
                      Gender
                    </label>
                    <SelectField
                      id="gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="select-field"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </SelectField>
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-white/10" />

              {/* Contact Information Section */}
              <FormSection title="Contact Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="email" className="label-text">
                      Student email (contact only)
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Not used for login"
                      className={`input-field ${fieldErrorClass(!!(touched.email && errors.email))}`}
                    />
                    {touched.email && errors.email && (
                      <p className="mt-1 text-sm text-red-300">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="label-text">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="address" className="label-text">
                      Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows={2}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="label-text">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="state" className="label-text">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="pincode" className="label-text">
                      Pincode
                    </label>
                    <input
                      type="text"
                      id="pincode"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-white/10" />

              {/* Parent Information Section */}
              <FormSection title="Parent / Guardian">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="father_name" className="label-text">
                      Father&apos;s Name
                    </label>
                    <input
                      type="text"
                      id="father_name"
                      name="father_name"
                      value={formData.father_name}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="father_phone" className="label-text">
                      Father&apos;s Phone
                    </label>
                    <input
                      type="tel"
                      id="father_phone"
                      name="father_phone"
                      value={formData.father_phone}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="mother_name" className="label-text">
                      Mother&apos;s Name
                    </label>
                    <input
                      type="text"
                      id="mother_name"
                      name="mother_name"
                      value={formData.mother_name}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="mother_phone" className="label-text">
                      Mother&apos;s Phone
                    </label>
                    <input
                      type="tel"
                      id="mother_phone"
                      name="mother_phone"
                      value={formData.mother_phone}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-white/10" />
                </>
              )}

              {/* Family login — single parent account */}
              <FormSection
                title="Parent Login"
                description="One parent login per family. Use the same email and password on the sign-in page to view all linked children."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="parent_type" className="label-text">
                      Login linked as
                    </label>
                    <SelectField
                      id="parent_type"
                      name="parent_type"
                      value={formData.parent_type}
                      onChange={handleChange}
                      className="select-field"
                    >
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                    </SelectField>
                  </div>

                  <div>
                    <label htmlFor="parent_login_email" className="label-text">
                      Parent login email
                    </label>
                    <input
                      type="email"
                      id="parent_login_email"
                      name="parent_login_email"
                      value={formData.parent_login_email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="parent@email.com"
                      className={`input-field ${fieldErrorClass(!!(touched.parent_login_email && errors.parent_login_email))}`}
                    />
                    {touched.parent_login_email && errors.parent_login_email && (
                      <p className="mt-1 text-sm text-red-300">{errors.parent_login_email}</p>
                    )}
                    {!editingStudent && formData.parent_login_email && (
                      <EmailOtpVerify
                        email={formData.parent_login_email}
                        purpose="parent_account"
                        onVerified={setParentEmailVerificationToken}
                        onReset={() => setParentEmailVerificationToken('')}
                      />
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="parent_login_password" className="label-text">
                      Parent login password
                      {!editingStudent && formData.parent_login_email && (
                        <span className="text-red-400"> *</span>
                      )}
                    </label>
                    <input
                      type="password"
                      id="parent_login_password"
                      name="parent_login_password"
                      value={formData.parent_login_password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder={editingStudent ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
                      autoComplete="new-password"
                      className={`input-field ${fieldErrorClass(!!(touched.parent_login_password && errors.parent_login_password))}`}
                    />
                    {touched.parent_login_password && errors.parent_login_password && (
                      <p className="mt-1 text-sm text-red-300">{errors.parent_login_password}</p>
                    )}
                    <p className="mt-1 text-xs text-white/50">
                      {editingStudent
                        ? 'Enter a new password only if you want to change it. The parent signs in with the email and password above.'
                        : 'Required when parent login email is provided. Parents use this email and password to log in.'}
                    </p>
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-white/10" />

              {/* Academic Information Section */}
              <FormSection title="Academic Information">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="class_id" className="label-text">
                      Class <span className="text-red-400">*</span>
                    </label>
                    <SelectField
                      id="class_id"
                      name="class_id"
                      value={formData.class_id}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      className={`select-field ${fieldErrorClass(!!(touched.class_id && errors.class_id))}`}
                    >
                      <option value="">Select Class</option>
                      {classes?.map((cls: any) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </SelectField>
                    {touched.class_id && errors.class_id && (
                      <p className="mt-1 text-sm text-red-300">{errors.class_id}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="section_id" className="label-text">
                      Section {sections && sections.length > 0 && <span className="text-red-400">*</span>}
                    </label>
                    <SelectField
                      id="section_id"
                      name="section_id"
                      value={formData.section_id}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required={sections && sections.length > 0}
                      disabled={!selectedClassId}
                      className={`select-field disabled:opacity-50 disabled:cursor-not-allowed ${fieldErrorClass(!!(touched.section_id && errors.section_id))}`}
                    >
                      <option value="">
                        {!selectedClassId 
                          ? 'Select Class First' 
                          : sections && sections.length === 0 
                            ? 'No Sections Available - Create Sections First' 
                            : 'Select Section'}
                      </option>
                      {sections?.map((section: any) => (
                        <option key={section.id} value={section.id}>
                          {section.name} {section.current_strength !== undefined && `(${section.current_strength}/${section.capacity || 40})`}
                        </option>
                      ))}
                    </SelectField>
                    {touched.section_id && errors.section_id && (
                      <p className="mt-1 text-sm text-red-300">{errors.section_id}</p>
                    )}
                    {selectedClassId && sections && sections.length === 0 && !errors.section_id && (
                      <p className="mt-1 text-sm text-amber-200/90">
                        No sections found for this class. Please create sections before adding students.
                      </p>
                    )}
                    {selectedClassId && sections && sections.length > 0 && !formData.section_id && !errors.section_id && (
                      <p className="mt-1 text-sm text-white/50">
                        Please select a section to continue.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="roll_number" className="label-text">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      id="roll_number"
                      name="roll_number"
                      value={formData.roll_number}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  {editingStudent && (
                    <div>
                      <label htmlFor="status" className="label-text">
                        Status
                      </label>
                      <SelectField
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        className="select-field"
                      >
                        <option value="Active">Active</option>
                        <option value="Transferred">Transferred</option>
                        <option value="Promoted">Promoted</option>
                        <option value="Failed">Failed</option>
                        <option value="Dropped">Dropped</option>
                      </SelectField>
                    </div>
                  )}
                </div>
              </FormSection>
                </form>
              </div>

              <div className="app-modal-footer">
                <button type="button" onClick={closeForm} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  form="student-form"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingStudent
                    ? updateMutation.isLoading
                      ? 'Saving...'
                      : 'Save Changes'
                    : createMutation.isLoading
                      ? 'Submitting...'
                      : isPreschool
                        ? 'Submit Application'
                        : 'Add Student'}
                </button>
              </div>
        </AppModal>

        {(!isTeacher || showStudentsAsClassTeacher) && (
          <>
            <div className="flex-1 min-h-0 flex flex-col table-shell students-page-table overflow-hidden">
              <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 students-toolbar">
                <div className="students-unified-toolbar-row">
                  <div className="students-toolbar-meta shrink-0">
                    <h1 className="text-sm font-semibold text-white leading-none">Students</h1>
                    <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                      {filteredStudents.length} / {students?.length || 0} records
                    </p>
                  </div>

                  <div className="students-toolbar-divider" aria-hidden />

                  <PageFilterSearch
                    id="search"
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search name, admission, mobile…"
                    hideLabel
                    className="students-toolbar-search"
                  />

                  {isTeacher && showStudentsAsClassTeacher ? (
                    <PageFilterField label="Scope" hideLabel className="students-toolbar-badge-field">
                      <PageFilterBadge className="students-toolbar-scope-badge">{classTeacherLabel}</PageFilterBadge>
                    </PageFilterField>
                  ) : (
                    <>
                      <PageFilterField id="filter_class" label="Class" hideLabel className="students-toolbar-select">
                        <MultiSelectDropdown
                          id="filter_class"
                          options={(classes || []).map((cls: { id: number; name: string }) => ({
                            value: String(cls.id),
                            label: cls.name,
                          }))}
                          value={filterClassIds}
                          onChange={(next) => {
                            setFilterClassIds(next)
                            setFilterSectionIds([])
                          }}
                          placeholder="Class"
                          compact
                          maxDisplayLabels={1}
                          aria-label="Filter by class"
                        />
                      </PageFilterField>

                      <PageFilterField id="filter_section" label="Section" hideLabel className="students-toolbar-select">
                        <MultiSelectDropdown
                          id="filter_section"
                          options={(filterSections || []).map((section: { id: number; name: string }) => ({
                            value: String(section.id),
                            label: section.name,
                          }))}
                          value={filterSectionIds}
                          onChange={setFilterSectionIds}
                          placeholder="Section"
                          compact
                          maxDisplayLabels={1}
                          disabled={filterClassIds.length === 0}
                          aria-label="Filter by section"
                        />
                      </PageFilterField>
                    </>
                  )}

                  <PageFilterField id="filter_status" label="Status" hideLabel className="students-toolbar-select">
                    <MultiSelectDropdown
                      id="filter_status"
                      options={statusFilterOptions}
                      value={filterStatuses}
                      onChange={setFilterStatuses}
                      placeholder="Status"
                      compact
                      maxDisplayLabels={1}
                      aria-label="Filter by status"
                    />
                  </PageFilterField>

                  <PageFilterActions className="students-toolbar-actions pb-0">
                    <ExportMenu
                      onExport={handleExport}
                      isExporting={isExporting}
                      recordCount={filteredStudents.length}
                      size="sm"
                    />
                    {canEditStudent ? (
                      <>
                        <button
                          type="button"
                          onClick={openImportModal}
                          className="students-toolbar-btn students-toolbar-btn-secondary"
                          title="Import students"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          <span className="hidden sm:inline">Import</span>
                        </button>
                        <button
                          type="button"
                          onClick={openNewStudentForm}
                          className="students-toolbar-btn students-toolbar-btn-primary"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Add</span>
                        </button>
                      </>
                    ) : null}
                  </PageFilterActions>
                </div>
                {exportError ? (
                  <p className="mt-1 text-[11px] text-red-200" role="alert">
                    {exportError}
                  </p>
                ) : null}
              </div>

              <div className="students-table-scroll overflow-x-hidden">
                <table className="data-table data-table-fit w-full">
                  <colgroup>
                    <col className="students-col-photo" />
                    <col className="students-col-admission" />
                    <col className="students-col-name" />
                    <col className="students-col-age" />
                    <col className="students-col-father" />
                    <col className="students-col-mobile" />
                    <col className="students-col-class" />
                    <col className="students-col-section" />
                    <col className="students-col-roll" />
                    <col className="students-col-status" />
                    <col className="students-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="students-col-photo" aria-label="Photo" />
                      <th className="students-col-admission">Adm#</th>
                      <th className="students-col-name">Name</th>
                      <th className="students-col-age">Age</th>
                      <th className="students-col-father">Father</th>
                      <th className="students-col-mobile">Mobile</th>
                      <th className="students-col-class">Class</th>
                      <th className="students-col-section">Sec.</th>
                      <th className="students-col-roll">Roll</th>
                      <th className="students-col-status">Status</th>
                      <th className="students-col-actions text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredStudents.map((student: any) => (
                      <tr key={student.id} className="students-table-row hover:bg-white/[0.04]">
                        <td className="students-col-photo">
                          <div className="students-photo-wrap">
                            <StudentAvatar student={student} size="xs" />
                          </div>
                        </td>
                        <td className="students-col-admission max-w-0">
                          <span
                            className="students-cell-text font-mono text-[10px] text-white/85"
                            title={student.admission_number}
                          >
                            {formatAdmissionDisplay(student.admission_number) || '—'}
                          </span>
                        </td>
                        <td className="students-col-name max-w-0">
                          <span className="students-cell-text font-medium" title={`${student.first_name} ${student.last_name}`}>
                            {student.first_name} {student.last_name}
                          </span>
                        </td>
                        <td className="students-col-age max-w-0">
                          <span
                            className="students-cell-text text-xs"
                            title={student.date_of_birth ? formatDisplayDate(student.date_of_birth) : undefined}
                          >
                            {formatStudentAge(student.date_of_birth)}
                          </span>
                        </td>
                        <td className="students-col-father max-w-0">
                          <span className="students-cell-text" title={student.father_name}>
                            {student.father_name || '—'}
                          </span>
                        </td>
                        <td className="students-col-mobile max-w-0">
                          {(() => {
                            const mobile = resolveStudentMobile(student)
                            return (
                              <span
                                className="students-cell-text font-mono text-[10px] text-white/80"
                                title={mobile || undefined}
                              >
                                {mobile || '—'}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="students-col-class max-w-0">
                          <span className="students-cell-text" title={student.class_name}>
                            {student.class_name}
                          </span>
                        </td>
                        <td className="students-col-section max-w-0">
                          <span className="students-cell-text" title={student.section_name}>
                            {student.section_name}
                          </span>
                        </td>
                        <td className="students-col-roll max-w-0">
                          <span className="students-cell-text">{student.roll_number || '—'}</span>
                        </td>
                        <td className="students-col-status">
                          <span
                            className={`students-status-tag ${
                              student.status === 'Active'
                                ? 'students-status-tag--active'
                                : student.status === 'Dropped'
                                  ? 'students-status-tag--dropped'
                                  : 'students-status-tag--neutral'
                            }`}
                          >
                            {student.status === 'Active' ? 'Active' : student.status === 'Dropped' ? 'Drop' : student.status}
                          </span>
                        </td>
                        <td className="students-col-actions">
                          <div className="flex items-center justify-center gap-px">
                            <button
                              type="button"
                              onClick={() => handleViewStudent(student)}
                              className="p-1 text-emerald-300 hover:bg-white/10 rounded"
                              title="View student"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {canEditStudent && (
                              <button
                                type="button"
                                onClick={() => handleEditStudent(student)}
                                className="p-1 text-blue-300 hover:bg-white/10 rounded"
                                title="Edit student"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {canDeleteStudent && student.status !== 'Dropped' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(student)}
                                disabled={deleteMutation.isLoading}
                                className="p-1 text-red-300 hover:bg-white/10 rounded disabled:opacity-50"
                                title="Remove student"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(studentsLoading || (isTeacher && dutyLoading)) && (
                  <div className="text-center py-8 text-white/60 text-xs">Loading students…</div>
                )}
                {!studentsLoading && !(isTeacher && dutyLoading) && (!students || students.length === 0) && (
                  <div className="text-center py-8 text-white/60 text-xs">
                    {isTeacher
                      ? 'No students in your assigned class and section.'
                      : 'No students found. Add a student to get started.'}
                  </div>
                )}
                {students && students.length > 0 && filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-white/60 text-xs">
                    No students match your search or filter criteria.
                  </div>
                )}
              </div>
              {filteredStudents.length > 0 && (
                <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
                  Showing {filteredStudents.length} of {students?.length || 0} students
                </div>
              )}
            </div>
          </>
        )}

        {/* View Student Modal */}
        {viewingStudent && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          >
            <div
              className="glass-card-opaque w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-view-title"
            >
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 shrink-0">
                <div>
                  <h2 id="student-view-title" className="modal-title">Student Profile</h2>
                  <p className="meta-text mt-1">Complete student record for {academicYear?.name || 'this year'}.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingStudent(null)}
                  className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-7">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-xl border border-white/10 bg-black/20 p-5">
                  <StudentAvatar student={viewingStudent} size="lg" />
                  <div className="text-center sm:text-left min-w-0">
                    <h3 className="text-xl font-semibold text-white">{getStudentDisplayName(viewingStudent)}</h3>
                    <p className="text-sm text-white/60 font-mono mt-1">{viewingStudent.admission_number}</p>
                    <span className={`inline-flex mt-2 px-2.5 py-1 text-xs rounded-full ${
                      viewingStudent.status === 'Active'
                        ? 'badge-success'
                        : viewingStudent.status === 'Dropped'
                          ? 'badge-danger'
                          : 'bg-white/15 text-white/80 border border-white/20'
                    }`}>
                      {viewingStudent.status}
                    </span>
                  </div>
                </div>

                <FormSection title="Personal Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ViewDetailField label="Admission Number" value={<span className="font-mono">{viewingStudent.admission_number}</span>} />
                    <ViewDetailField
                      label={isPreschool ? 'Name' : 'Full Name'}
                      value={getStudentDisplayName(viewingStudent)}
                    />
                    {isPreschool && viewingStudent.middle_name && (
                      <ViewDetailField label="Middle Name" value={viewingStudent.middle_name} />
                    )}
                    {isPreschool && viewingStudent.last_name && (
                      <ViewDetailField label="Surname" value={viewingStudent.last_name} />
                    )}
                    <ViewDetailField label="Date of Birth" value={formatDisplayDate(viewingStudent.date_of_birth)} />
                    <ViewDetailField label="Age" value={formatStudentAge(viewingStudent.date_of_birth)} />
                    <ViewDetailField label="Gender" value={viewingStudent.gender} />
                    {isPreschool && (
                      <ViewDetailField label="Aadhaar No." value={viewingStudent.aadhaar_number} />
                    )}
                    {isPreschool && (
                      <ViewDetailField label="Place of Birth" value={viewingStudent.place_of_birth} />
                    )}
                  </div>
                </FormSection>

                <FormSection title="Contact Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ViewDetailField label="Email" value={viewingStudent.email} />
                    <ViewDetailField label="Phone" value={viewingStudent.phone} />
                    <ViewDetailField label="City" value={viewingStudent.city} />
                    <ViewDetailField label="State" value={viewingStudent.state} />
                    <ViewDetailField label="Pincode" value={viewingStudent.pincode} />
                    <ViewDetailField label="Address" value={viewingStudent.address} className="sm:col-span-2 lg:col-span-3" />
                  </div>
                </FormSection>

                <FormSection title="Parent / Guardian">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ViewDetailField label="Father's Name" value={viewingStudent.father_name} />
                    <ViewDetailField label="Father's Phone" value={viewingStudent.father_phone} />
                    <ViewDetailField label="Mother's Name" value={viewingStudent.mother_name} />
                    <ViewDetailField label="Mother's Phone" value={viewingStudent.mother_phone} />
                  </div>
                </FormSection>

                <FormSection title="Academic Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <ViewDetailField label="Class" value={viewingStudent.class_name} />
                    <ViewDetailField label="Section" value={viewingStudent.section_name} />
                    <ViewDetailField label="Roll Number" value={viewingStudent.roll_number} />
                    <ViewDetailField label="Status" value={viewingStudent.status} />
                  </div>
                </FormSection>

                <FormSection title="Parent Login">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ViewDetailField
                      label="Linked as"
                      value={
                        viewingStudent.parent_account?.parent_type ||
                        (viewingStudent.father_email ? 'father' : viewingStudent.mother_email ? 'mother' : viewingStudent.guardian_email ? 'guardian' : null)
                      }
                    />
                    <ViewDetailField
                      label="Login email"
                      value={
                        viewingStudent.parent_account?.email ||
                        viewingStudent.father_email ||
                        viewingStudent.mother_email ||
                        viewingStudent.guardian_email
                      }
                    />
                    <ViewDetailField
                      label="Account status"
                      value={
                        viewingStudent.parent_account?.has_login
                          ? 'Active parent login'
                          : viewingStudent.parent_account?.email || viewingStudent.father_email || viewingStudent.mother_email || viewingStudent.guardian_email
                            ? 'Email saved — login not created yet'
                            : 'Not configured'
                      }
                    />
                  </div>
                </FormSection>

                {isPreschool && viewingStudent.admission_form_data?.documents && (
                  <FormSection title="Uploaded Documents">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {STUDENT_DOCUMENT_TYPES.map((docType) => {
                        const url = viewingStudent.admission_form_data?.documents?.[docType]
                        if (!url) return null
                        const src = getStudentDocumentUrl(url)
                        const isPdf = url.toLowerCase().includes('.pdf')
                        return (
                          <div key={docType} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                            <p className="text-xs font-medium text-white/70">{STUDENT_DOCUMENT_LABELS[docType]}</p>
                            {isPdf ? (
                              <a href={src || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-300 hover:underline">
                                View PDF
                              </a>
                            ) : src ? (
                              <a href={src} target="_blank" rel="noopener noreferrer">
                                <img src={src} alt="" className="w-full h-28 object-cover rounded-lg border border-white/10" />
                              </a>
                            ) : (
                              <span className="text-sm text-white/50">—</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </FormSection>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0 bg-black/25">
                <button type="button" onClick={() => setViewingStudent(null)} className="btn-secondary">
                  Close
                </button>
                {canEditStudent && (
                  <button type="button" onClick={() => handleEditStudent(viewingStudent)} className="btn-primary">
                    Edit Student
                  </button>
                )}
                {canDeleteStudent && viewingStudent.status !== 'Dropped' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStudent(viewingStudent)}
                    disabled={deleteMutation.isLoading}
                    className="btn-secondary text-red-200 border-red-400/30 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Remove Student
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          >
            <div
              className="glass-card w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="import-students-title"
            >
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 shrink-0">
                <div>
                  <h2 id="import-students-title" className="modal-title">
                    Import Students
                  </h2>
                  <p className="meta-text mt-1">
                    Bulk enroll students via CSV for the selected academic year, class, and section.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetImportModal}
                  className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                <FormSection
                  title="Import Target"
                  description="All rows in the CSV will be enrolled in this branch, year, class, and section. Each row must include Total Amount (₹)—a fee structure is created automatically for every imported student."
                >
                  <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-white/55">Branch</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{branchLabel}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-4">
                    <div>
                      <label htmlFor="import_academic_year" className="label-text">
                        Academic Year <span className="text-red-400">*</span>
                      </label>
                      <SelectField
                        id="import_academic_year"
                        value={importAcademicYearId}
                        onChange={(e) => {
                          setImportAcademicYearId(e.target.value)
                          setImportClassId('')
                          setImportSectionId('')
                          setImportFile(null)
                        }}
                        className="select-field"
                      >
                        <option value="">Select academic year</option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.name}
                            {year.is_active ? ' (Active)' : ''}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label htmlFor="import_class" className="label-text">
                        Class <span className="text-red-400">*</span>
                      </label>
                      <SelectField
                        id="import_class"
                        value={importClassId}
                        onChange={(e) => {
                          setImportClassId(e.target.value)
                          setImportSectionId('')
                          setImportFile(null)
                        }}
                        disabled={!importAcademicYearId}
                        className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select class</option>
                        {importClasses?.map((cls: { id: number; name: string }) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label htmlFor="import_section" className="label-text">
                        Section <span className="text-red-400">*</span>
                      </label>
                      <SelectField
                        id="import_section"
                        value={importSectionId}
                        onChange={(e) => {
                          setImportSectionId(e.target.value)
                          setImportFile(null)
                        }}
                        disabled={!importClassId}
                        className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select section</option>
                        {importSections?.map((sec: { id: number; name: string }) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                  </div>

                  {importTargetReady && selectedImportAcademicYear && selectedImportClass && selectedImportSection && (
                    <div className="alert-success">
                      Import target: {branchLabel} — {selectedImportAcademicYear.name} — {selectedImportClass.name} — Section {selectedImportSection.name}
                    </div>
                  )}
                  {isAllBranches && (
                    <div className="alert-error">
                      Select a single branch in the top bar before importing.
                    </div>
                  )}
                </FormSection>

                <div className="border-t border-white/10" />

                <FormSection title="Download Template">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-white/10 bg-black/15 p-4">
                    <p className="body-text text-sm">
                      {importTargetReady
                        ? `Download a CSV template for ${selectedImportAcademicYear?.name}, ${selectedImportClass?.name}, Section ${selectedImportSection?.name}. Fill in student details and Total Amount (₹) for each row—a fee structure is created on import.`
                        : 'Select academic year, class, and section above to download the template for that group.'}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        downloadStudentImportTemplate(
                          selectedImportClass?.name,
                          selectedImportSection?.name,
                          selectedImportAcademicYear?.name
                        )
                      }
                      disabled={!importTargetReady}
                      className="btn-primary shrink-0 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download Template
                    </button>
                  </div>
                </FormSection>

                <div className="border-t border-white/10" />

                <FormSection title="Upload CSV">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="btn-secondary cursor-pointer shrink-0">
                      Choose File
                      <input
                        type="file"
                        accept=".csv"
                        disabled={!importTargetReady}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setImportFile(file)
                            setImportProgress('')
                          }
                        }}
                      />
                    </label>
                    <p className="meta-text text-sm truncate">
                      {importFile ? importFile.name : 'No file selected — CSV (.csv) only'}
                    </p>
                  </div>
                </FormSection>

                <div className="alert-info">
                  <p className="font-semibold mb-2">CSV format requirements</p>
                  <ul className="space-y-1.5 text-sm list-disc list-inside marker:text-white/50">
                    <li>First row must contain column headers from the downloaded template</li>
                    <li>Required column: First Name</li>
                    <li>Optional: Admission Number, Last Name, Roll Number, Date of Birth, Gender, Email, Phone, Address, City, State, Pincode, Father/Mother names and phones</li>
                    <li>Do not include Academic Year, Class, or Section in the CSV</li>
                    <li>Existing admission numbers are updated; blank ones get auto-generated IDs</li>
                  </ul>
                </div>

                {importProgress && (
                  <div className="alert-warning">{importProgress}</div>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0 bg-black/15">
                <button type="button" onClick={resetImportModal} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!importAcademicYearId || !importClassId || !importSectionId) {
                      alert('Please select academic year, class, and section for import')
                      return
                    }
                    if (!importFile) {
                      alert('Please select a file to import')
                      return
                    }
                    setImportProgress('Processing...')
                    importMutation.mutate(importFile)
                  }}
                  disabled={!importTargetReady || !importFile || importMutation.isLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importMutation.isLoading ? 'Importing...' : 'Import Students'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
