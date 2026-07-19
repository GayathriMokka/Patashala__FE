'use client'

import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useMemo } from 'react'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterClearButton,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { downloadTeacherImportTemplate } from '@/lib/teacherImportTemplate'
import { getTeacherPhotoUrl, getTeacherInitials, validateTeacherPhotoFile } from '@/lib/teacherPhoto'
import { getApiUrl } from '@/lib/api'
import { formatMoney } from '@/lib/formatMoney'
import AppModal from '@/components/AppModal'

const API_URL = getApiUrl()

const AVATAR_SIZES = {
  xs: { px: 24, text: 'text-[9px]' },
  sm: { px: 32, text: 'text-[11px]' },
  md: { px: 56, text: 'text-base' },
  lg: { px: 80, text: 'text-xl' },
} as const

function TeacherAvatar({
  teacher,
  size = 'md',
}: {
  teacher: { name?: string; photo_url?: string | null }
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const photoSrc = getTeacherPhotoUrl(teacher?.photo_url)
  const { px, text } = AVATAR_SIZES[size]

  return (
    <div
      className="teacher-profile-avatar shrink-0 rounded-full overflow-hidden border-2 border-white/25 bg-white/10 pointer-events-none select-none"
      style={{ width: px, height: px, minWidth: px, minHeight: px }}
      aria-hidden
    >
      {photoSrc ? (
        <img
          src={photoSrc}
          alt=""
          width={px}
          height={px}
          draggable={false}
          className="h-full w-full object-cover object-center"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-amber-400/15 font-semibold text-amber-200 ${text}`}
        >
          {getTeacherInitials(teacher?.name)}
        </div>
      )}
    </div>
  )
}

function formatEmployeeIdDisplay(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
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
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white">{title}</h4>
        </div>
        {description && <p className="meta-text mt-1.5 ml-3.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

const fieldErrorClass = (hasError: boolean) =>
  hasError ? 'border-red-400/70 focus:ring-red-400/30' : ''

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
    <div className={`rounded-lg border border-white/15 bg-black/35 px-4 py-3 ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-white/55 mb-1">{label}</p>
      <div className="text-sm text-white/95 break-words">{value != null && value !== '' ? value : '—'}</div>
    </div>
  )
}

export default function TeachersPage() {
  const { user, token } = useAuth()
  const {
    scopedHeaders,
    branchScopeKey,
    branch,
    isAllBranches,
    requireBranchForWrite,
    requireAcademicYearSelected,
    branchLabel,
    academicYear,
  } = useBranchYearScope()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<any>(null)
  const [viewingTeacher, setViewingTeacher] = useState<any>(null)
  const [teacherCertificates, setTeacherCertificates] = useState<any[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importProgress, setImportProgress] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const [formData, setFormData] = useState({
    // User fields
    name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    // Teacher fields
    employee_id: '',
    qualification: '',
    specialization: '',
    experience_years: '',
    joining_date: '',
  })
  const [certificates, setCertificates] = useState<File[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [employeeIdPreview, setEmployeeIdPreview] = useState('')
  const [loadingEmployeeIdPreview, setLoadingEmployeeIdPreview] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterBranchNames, setFilterBranchNames] = useState<string[]>([])
  const [filterQualifications, setFilterQualifications] = useState<string[]>([])

  const { data: teachers, refetch, isLoading: teachersLoading } = useQuery(
    ['teachers', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/teachers`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!token && !!academicYear?.id }
  )

  const branchFilterOptions = useMemo(() => {
    const names = new Set<string>()
    ;(teachers || []).forEach((teacher: { branch_name?: string }) => {
      const name = String(teacher.branch_name || '').trim()
      if (name) names.add(name)
    })
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }))
  }, [teachers])

  const qualificationFilterOptions = useMemo(() => {
    const values = new Set<string>()
    ;(teachers || []).forEach((teacher: { qualification?: string }) => {
      const qualification = String(teacher.qualification || '').trim()
      if (qualification) values.add(qualification)
    })
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }))
  }, [teachers])

  const filteredTeachers = useMemo(() => {
    return (teachers || []).filter((teacher: any) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
          teacher.name?.toLowerCase().includes(searchLower) ||
          teacher.email?.toLowerCase().includes(searchLower) ||
          teacher.employee_id?.toLowerCase().includes(searchLower) ||
          teacher.phone?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }

      if (
        filterBranchNames.length > 0 &&
        !filterBranchNames.includes(String(teacher.branch_name || '').trim())
      ) {
        return false
      }

      if (
        filterQualifications.length > 0 &&
        !filterQualifications.includes(String(teacher.qualification || '').trim())
      ) {
        return false
      }

      return true
    })
  }, [teachers, searchTerm, filterBranchNames, filterQualifications])

  const hasActiveFilters =
    !!searchTerm || filterBranchNames.length > 0 || filterQualifications.length > 0

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Teachers',
      filename: 'teachers',
      getSubtitle: () => {
        const parts: string[] = []
        if (searchTerm.trim()) parts.push(`Search: ${searchTerm.trim()}`)
        if (filterBranchNames.length) parts.push(`Branch: ${filterBranchNames.join(', ')}`)
        if (filterQualifications.length) parts.push(`Qualification: ${filterQualifications.join(', ')}`)
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'employee_id', label: 'Employee ID' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'qualification', label: 'Qualification' },
        { key: 'specialization', label: 'Specialization' },
        { key: 'experience_years', label: 'Experience (yrs)' },
        { key: 'branch_name', label: 'Branch' },
      ],
      getRows: () =>
        filteredTeachers.map((t: any) => ({
          name: t.name || '',
          employee_id: t.employee_id || '',
          email: t.email || '',
          phone: t.phone || '',
          qualification: t.qualification || '',
          specialization: t.specialization || '',
          experience_years: t.experience_years ?? '',
          branch_name: t.branch_name || '',
        })),
    },
  })

  const fetchEmployeeIdPreview = async () => {
    if (!user?.school_id || !token) return
    setLoadingEmployeeIdPreview(true)
    try {
      const response = await axios.get(`${API_URL}/employee-id-settings/preview`, {
        params: { school_id: user.school_id },
        headers: { Authorization: `Bearer ${token}` },
      })
      setEmployeeIdPreview(response.data.data?.employee_id || '')
    } catch {
      setEmployeeIdPreview('')
    } finally {
      setLoadingEmployeeIdPreview(false)
    }
  }

  useEffect(() => {
    if (showForm && !editingTeacher) {
      fetchEmployeeIdPreview()
    }
  }, [showForm, editingTeacher, user?.school_id, token])

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const { photoFile, removePhoto, certificates, ...textData } = data
      const hasCertificates = certificates && certificates.length > 0
      const authHeaders = { ...scopedHeaders }

      let response

      if (hasCertificates) {
        const formDataToSend = new FormData()
        Object.keys(textData).forEach((key) => {
          if (textData[key] !== undefined && textData[key] !== '') {
            formDataToSend.append(key, textData[key])
          }
        })
        certificates.forEach((file: File) => {
          formDataToSend.append('certificates', file)
        })
        formDataToSend.append('school_id', String(user?.school_id || ''))

        response = await axios.put(`${API_URL}/teachers/${id}`, formDataToSend, {
          headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' },
        })
      } else {
        response = await axios.put(
          `${API_URL}/teachers/${id}`,
          { ...textData, school_id: user?.school_id },
          { headers: authHeaders }
        )
      }

      if (removePhoto) {
        await axios.delete(`${API_URL}/teachers/${id}/photo`, { headers: authHeaders })
      } else if (photoFile) {
        const formDataPhoto = new FormData()
        formDataPhoto.append('photo', photoFile)
        formDataPhoto.append('school_id', String(user?.school_id || ''))
        await axios.post(`${API_URL}/teachers/${id}/photo`, formDataPhoto, {
          headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' },
        })
      }

      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['teachers'])
        refetch()
        closeForm()
        alert('Teacher updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update teacher error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to update teacher'
        alert(errorMessage)
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/teachers/${id}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['teachers'])
        refetch()
        alert('Teacher deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete teacher error:', error)
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete teacher'
        alert(errorMessage)
      },
    }
  )

  const resetImportModal = () => {
    setShowImportModal(false)
    setImportFile(null)
    setImportProgress('')
  }

  const importMutation = useMutation(
    async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('school_id', String(user?.school_id || ''))

      const response = await axios.post(
        `${API_URL}/teachers/import`,
        formData,
        {
          headers: {
            ...scopedHeaders,
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              setImportProgress(`Uploading: ${percentCompleted}%`)
            }
          },
        }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['teachers'])
        refetch()
        setShowImportModal(false)
        setImportFile(null)
        setImportProgress('')
        const errorMsg = data.errors && data.errors.length > 0 ? ` ${data.errors.length} errors occurred.` : ''
        alert(`Import successful! ${data.success_count || 0} teachers imported.${errorMsg}`)
      },
      onError: (error: any) => {
        console.error('Import error:', error)
        const errorMessage = error.response?.data?.error || error.message || 'Failed to import teachers'
        alert(errorMessage)
        setImportProgress('')
      },
    }
  )

  const createMutation = useMutation(
    async (data: any) => {
      const formDataToSend = new FormData()
      
      // Add all text fields - always include required fields even if empty
      Object.keys(data).forEach(key => {
        if (key !== 'certificates') {
          // Always include required fields, include optional fields only if they have values
          if (key === 'employee_id') {
            return
          }
          if (key === 'name' || key === 'email' || key === 'password') {
            formDataToSend.append(key, data[key] || '')
          } else if (data[key] !== undefined && data[key] !== '') {
            formDataToSend.append(key, data[key])
          }
        }
      })
      
      // Add certificate files
      if (data.certificates && data.certificates.length > 0) {
        data.certificates.forEach((file: File, index: number) => {
          formDataToSend.append('certificates', file)
        })
      }
      
      formDataToSend.append('school_id', String(user?.school_id || ''))
      if (branch?.id) {
        formDataToSend.append('branch_id', String(branch.id))
      }

      // Debug: Log FormData contents
      console.log('FormData being sent:')
      for (const [key, value] of formDataToSend.entries()) {
        console.log(key, ':', value instanceof File ? value.name : value)
      }

      const response = await axios.post(
        `${API_URL}/teachers`,
        formDataToSend,
        {
          headers: {
            ...scopedHeaders,
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      return response.data
    },
    {
      onSuccess: async (data) => {
        const teacherId = data?.data?.id
        try {
          if (teacherId && photoFile) {
            const formDataPhoto = new FormData()
            formDataPhoto.append('photo', photoFile)
            formDataPhoto.append('school_id', String(user?.school_id || ''))
            await axios.post(`${API_URL}/teachers/${teacherId}/photo`, formDataPhoto, {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data',
              },
            })
          }
        } catch (photoErr: any) {
          console.error('Photo upload error:', photoErr)
          alert(
            photoErr.response?.data?.error ||
              'Teacher added, but the profile photo could not be uploaded. Edit the teacher to add a photo.'
          )
        }
        queryClient.invalidateQueries(['teachers'])
        refetch()
        closeForm()
        const assignedId = data?.data?.employee_id
        alert(assignedId ? `Teacher added successfully! Employee ID: ${assignedId}` : 'Teacher added successfully!')
      },
      onError: (error: any) => {
        console.error('Create teacher error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to add teacher'
        alert(errorMessage)
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const photoError = validateTeacherPhotoFile(file)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    // Password validation only required when creating new teacher
    if (!editingTeacher) {
      if (!formData.password) {
        newErrors.password = 'Password is required'
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }

      if (!formData.confirm_password) {
        newErrors.confirm_password = 'Please confirm your password'
      } else if (formData.password !== formData.confirm_password) {
        newErrors.confirm_password = 'Passwords do not match'
      }
    }

    if (editingTeacher && !formData.employee_id.trim()) {
      newErrors.employee_id = 'Employee ID is required'
    }

    // Validate phone if provided
    if (formData.phone && !/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format'
    }

    // Validate experience years if provided
    if (formData.experience_years && (isNaN(Number(formData.experience_years)) || Number(formData.experience_years) < 0)) {
      newErrors.experience_years = 'Experience years must be a positive number'
    }

    // Validate joining date if provided
    if (formData.joining_date) {
      const joiningDate = new Date(formData.joining_date)
      const today = new Date()
      if (joiningDate > today) {
        newErrors.joining_date = 'Joining date cannot be in the future'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingTeacher) {
      const yearErr = requireAcademicYearSelected()
      if (yearErr) {
        alert(yearErr)
        return
      }
      const branchErr = requireBranchForWrite()
      if (branchErr) {
        alert(branchErr)
        return
      }
    }

    if (!validateForm()) {
      // Mark all fields as touched to show errors
      const allFields = Object.keys(formData)
      const touchedFields: Record<string, boolean> = {}
      allFields.forEach(field => {
        touchedFields[field] = true
      })
      setTouched(touchedFields)
      return
    }

    const submitData = {
      name: formData.name,
      email: formData.email,
      password: editingTeacher ? undefined : formData.password, // Don't send password if editing
      phone: formData.phone || undefined,
      employee_id: editingTeacher ? formData.employee_id : undefined,
      qualification: formData.qualification || undefined,
      specialization: formData.specialization || undefined,
      experience_years: formData.experience_years || undefined,
      joining_date: formData.joining_date || undefined,
      certificates: certificates,
      photoFile: photoFile || undefined,
      removePhoto: editingTeacher ? removePhoto : undefined,
    }

    if (editingTeacher) {
      updateMutation.mutate({ id: editingTeacher.id, data: submitData })
    } else {
      createMutation.mutate(submitData)
    }
  }

  const clearFormState = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirm_password: '',
      phone: '',
      employee_id: '',
      qualification: '',
      specialization: '',
      experience_years: '',
      joining_date: '',
    })
    setCertificates([])
    clearPhotoState()
    setEmployeeIdPreview('')
    setEditingTeacher(null)
    setErrors({})
    setTouched({})
  }

  const closeForm = () => {
    clearFormState()
    setShowForm(false)
  }

  const openNewTeacherForm = () => {
    const yearErr = requireAcademicYearSelected()
    if (yearErr) {
      alert(yearErr)
      return
    }
    const branchErr = requireBranchForWrite()
    if (branchErr) {
      alert(branchErr)
      return
    }
    clearFormState()
    setShowForm(true)
  }

  const handleEditTeacher = (teacher: any) => {
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setRemovePhoto(false)
    setExistingPhotoUrl(teacher.photo_url || null)
    setPhotoPreview(getTeacherPhotoUrl(teacher.photo_url))
    setEditingTeacher(teacher)
    setFormData({
      name: teacher.name || '',
      email: teacher.email || '',
      password: '',
      confirm_password: '',
      phone: teacher.phone || '',
      employee_id: teacher.employee_id || '',
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
      experience_years: teacher.experience_years || '',
      joining_date: teacher.joining_date || '',
    })
    setCertificates([])
    setShowForm(true)
  }

  const handleDeleteTeacher = (teacher: any) => {
    if (window.confirm(`Are you sure you want to delete ${teacher.name}? This action cannot be undone.`)) {
      deleteMutation.mutate(teacher.id)
    }
  }

  const handleViewTeacher = async (teacher: any) => {
    setViewingTeacher(teacher)
    setTeacherCertificates([]) // Reset certificates
    
    // Fetch certificates for this teacher
    try {
      const response = await axios.get(
        `${API_URL}/teachers/${teacher.id}/certificates`,
        {
          params: {
            school_id: user?.school_id,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      setTeacherCertificates(response.data.data || [])
    } catch (error: any) {
      console.error('Error fetching certificates:', error)
      // If error is 404 or table doesn't exist, just show empty list
      if (error.response?.status !== 404) {
        console.error('Failed to fetch certificates:', error.response?.data?.error || error.message)
      }
      setTeacherCertificates([])
    }
  }

  const handleCertificateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setCertificates(prev => [...prev, ...files])
    }
  }

  const removeCertificate = (index: number) => {
    setCertificates(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <Layout>
      <div className="flex flex-col page-container-viewport overflow-hidden gap-2">
        <div className="flex-1 min-h-0 flex flex-col table-shell teachers-page-table overflow-hidden">
          <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 teachers-toolbar">
            <div className="teachers-unified-toolbar-row">
              <div className="teachers-toolbar-meta shrink-0">
                <h1 className="text-sm font-semibold text-white leading-none">Teachers</h1>
                <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                  {filteredTeachers.length} / {teachers?.length || 0} records
                  {academicYear?.name ? ` · ${academicYear.name}` : ''}
                </p>
              </div>

              <div className="teachers-toolbar-divider" aria-hidden />

              <PageFilterSearch
                id="teacher_search"
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search name, email, ID…"
                hideLabel
                className="teachers-toolbar-search"
              />

              <PageFilterField id="filter_teacher_branch" label="Branch" hideLabel className="teachers-toolbar-select">
                <MultiSelectDropdown
                  id="filter_teacher_branch"
                  options={branchFilterOptions}
                  value={filterBranchNames}
                  onChange={setFilterBranchNames}
                  placeholder="Branch"
                  compact
                  maxDisplayLabels={1}
                  aria-label="Filter by branch"
                />
              </PageFilterField>

              <PageFilterField
                id="filter_teacher_qualification"
                label="Qualification"
                hideLabel
                className="teachers-toolbar-select teachers-toolbar-select-wide"
              >
                <MultiSelectDropdown
                  id="filter_teacher_qualification"
                  options={qualificationFilterOptions}
                  value={filterQualifications}
                  onChange={setFilterQualifications}
                  placeholder="Qual."
                  compact
                  maxDisplayLabels={1}
                  aria-label="Filter by qualification"
                />
              </PageFilterField>

              <PageFilterActions className="teachers-toolbar-actions pb-0">
                {hasActiveFilters ? (
                  <PageFilterClearButton
                    label="Clear"
                    className="teachers-toolbar-clear"
                    onClick={() => {
                      setSearchTerm('')
                      setFilterBranchNames([])
                      setFilterQualifications([])
                    }}
                  />
                ) : null}
                <ExportMenu
                  onExport={handleExport}
                  isExporting={isExporting}
                  recordCount={filteredTeachers.length}
                  size="sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const yearErr = requireAcademicYearSelected()
                    if (yearErr) {
                      alert(yearErr)
                      return
                    }
                    setShowImportModal(true)
                  }}
                  className="teachers-toolbar-btn teachers-toolbar-btn-secondary"
                  title="Import teachers"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="hidden sm:inline">Import</span>
                </button>
                <button
                  type="button"
                  onClick={openNewTeacherForm}
                  className="teachers-toolbar-btn teachers-toolbar-btn-primary"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add</span>
                </button>
              </PageFilterActions>
            </div>
            {exportError ? (
              <p className="mt-1 text-[11px] text-red-200" role="alert">
                {exportError}
              </p>
            ) : null}
          </div>

          {!academicYear?.id ? (
            <div className="flex-1 flex items-center justify-center text-white/60 text-sm py-12 px-6 text-center">
              Select an academic year from the top bar to view teachers for that year.
            </div>
          ) : teachersLoading ? (
            <div className="flex-1 flex items-center justify-center text-white/60 text-sm py-12">
              Loading teachers for {academicYear.name}…
            </div>
          ) : teachers && teachers.length > 0 ? (
            <>
              <div className="teachers-table-scroll overflow-x-hidden">
                <table className="data-table data-table-fit w-full">
                  <colgroup>
                    <col className="teachers-col-photo" />
                    <col className="teachers-col-name" />
                    <col className="teachers-col-id" />
                    <col className="teachers-col-email" />
                    <col className="teachers-col-phone" />
                    <col className="teachers-col-qual" />
                    <col className="teachers-col-exp" />
                    <col className="teachers-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="teachers-col-photo" aria-label="Photo" />
                      <th className="teachers-col-name">Name</th>
                      <th className="teachers-col-id">Emp#</th>
                      <th className="teachers-col-email">Email</th>
                      <th className="teachers-col-phone">Phone</th>
                      <th className="teachers-col-qual">Qual.</th>
                      <th className="teachers-col-exp">Exp</th>
                      <th className="teachers-col-actions text-center">Act.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredTeachers.map((teacher: any) => (
                      <tr key={teacher.id} className="teachers-table-row hover:bg-white/[0.04]">
                        <td className="teachers-col-photo">
                          <div className="teachers-photo-wrap">
                            <TeacherAvatar teacher={teacher} size="xs" />
                          </div>
                        </td>
                        <td className="teachers-col-name max-w-0">
                          <span className="teachers-cell-text font-medium" title={teacher.name}>
                            {teacher.name}
                          </span>
                        </td>
                        <td className="teachers-col-id max-w-0">
                          <span
                            className="teachers-cell-text font-mono text-[10px] text-white/85"
                            title={teacher.employee_id}
                          >
                            {formatEmployeeIdDisplay(teacher.employee_id) || '—'}
                          </span>
                        </td>
                        <td className="teachers-col-email max-w-0">
                          <span className="teachers-cell-text text-[11px]" title={teacher.email}>
                            {teacher.email || '—'}
                          </span>
                        </td>
                        <td className="teachers-col-phone max-w-0">
                          <span className="teachers-cell-text font-mono text-[10px] text-white/80" title={teacher.phone}>
                            {teacher.phone || '—'}
                          </span>
                        </td>
                        <td className="teachers-col-qual max-w-0">
                          <span className="teachers-cell-text text-[11px]" title={teacher.qualification}>
                            {teacher.qualification || '—'}
                          </span>
                        </td>
                        <td className="teachers-col-exp max-w-0 text-center">
                          <span className="teachers-cell-text text-[11px] tabular-nums">
                            {teacher.experience_years != null && teacher.experience_years !== ''
                              ? `${teacher.experience_years}y`
                              : '—'}
                          </span>
                        </td>
                        <td className="teachers-col-actions">
                          <div className="flex items-center justify-center gap-px">
                            <button
                              type="button"
                              onClick={() => handleViewTeacher(teacher)}
                              className="p-1 text-emerald-300 hover:bg-white/10 rounded"
                              title="View"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditTeacher(teacher)}
                              className="p-1 text-blue-300 hover:bg-white/10 rounded"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeacher(teacher)}
                              className="p-1 text-red-300 hover:bg-white/10 rounded"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredTeachers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-white/55 text-xs">
                          No teachers match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
                Showing {filteredTeachers.length} of {teachers.length} teachers
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/60 text-sm py-12 px-6 text-center">
              No teachers enrolled for {academicYear.name}. Add a teacher or clone staff from Master Data → Academic Year Clone.
            </div>
          )}
        </div>

        <AppModal open={showForm} onClose={closeForm} panelClassName="max-w-3xl" labelledBy="teacher-form-title">
              <div className="app-modal-header">
                <div>
                  <h2 id="teacher-form-title" className="modal-title">
                    {editingTeacher ? 'Edit Teacher' : 'Add Teacher'}
                  </h2>
                  <p className="meta-text mt-1">
                    {editingTeacher
                      ? 'Update profile, account, and professional details.'
                      : 'Register a new teacher with login credentials and profile.'}
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
                <form id="teacher-form" onSubmit={handleSubmit} className="space-y-7">
              <FormSection title="Profile Photo">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-xl border border-white/15 bg-black/35 p-5">
                <div
                  className="teacher-profile-avatar shrink-0 overflow-hidden rounded-full border-4 border-white/20 bg-amber-400/15 shadow-lg ring-2 ring-amber-400/30"
                  style={{ width: 96, height: 96, minWidth: 96, minHeight: 96 }}
                >
                  {photoPreview && !removePhoto ? (
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      draggable={false}
                      className="h-full w-full object-cover object-center pointer-events-none select-none"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-amber-200">
                      {getTeacherInitials(formData.name)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="body-text">Shown on the teacher list and profile view.</p>
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

              <FormSection title="Personal Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="name" className="label-text">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={() => handleBlur('name')}
                      required
                      className={`input-field ${fieldErrorClass(!!(touched.name && errors.name))}`}
                    />
                    {touched.name && errors.name && (
                      <p className="mt-1 text-sm text-red-300">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="label-text">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={() => handleBlur('email')}
                      required
                      className={`input-field ${fieldErrorClass(!!(touched.email && errors.email))}`}
                    />
                    {touched.email && errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="label-text">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      onBlur={() => handleBlur('phone')}
                      className={`input-field ${fieldErrorClass(!!(touched.phone && errors.phone))}`}
                    />
                    {touched.phone && errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="employee_id" className="label-text">
                      Employee ID {editingTeacher && <span className="text-red-400">*</span>}
                    </label>
                    {editingTeacher ? (
                      <input
                        type="text"
                        id="employee_id"
                        name="employee_id"
                        value={formData.employee_id}
                        onChange={handleChange}
                        onBlur={() => handleBlur('employee_id')}
                        disabled
                        className="input-field opacity-60 cursor-not-allowed"
                      />
                    ) : (
                      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3">
                        <p className="text-xs font-medium text-amber-200 mb-1">Auto-generated on save</p>
                        <p className="text-base font-semibold font-mono text-white">
                          {loadingEmployeeIdPreview
                            ? 'Loading preview...'
                            : employeeIdPreview || 'Configure format in Master Data → Employee ID'}
                        </p>
                      </div>
                    )}
                    {touched.employee_id && errors.employee_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.employee_id}</p>
                    )}
                    {!editingTeacher && (
                      <p className="mt-1 text-xs text-white/50">
                        Format is configured in Master Data → Employee ID.
                      </p>
                    )}
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-white/10" />

              {!editingTeacher && (
                <FormSection title="Account Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                      <div>
                        <label htmlFor="password" className="label-text">
                          Password <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="password"
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          onBlur={() => handleBlur('password')}
                          required
                          className={`input-field ${fieldErrorClass(!!(touched.password && errors.password))}`}
                        />
                        {touched.password && errors.password && (
                          <p className="mt-1 text-sm text-red-300">{errors.password}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="confirm_password" className="label-text">
                          Confirm Password <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="password"
                          id="confirm_password"
                          name="confirm_password"
                          value={formData.confirm_password}
                          onChange={handleChange}
                          onBlur={() => handleBlur('confirm_password')}
                          required
                          className={`input-field ${fieldErrorClass(!!(touched.confirm_password && errors.confirm_password))}`}
                        />
                        {touched.confirm_password && errors.confirm_password && (
                          <p className="mt-1 text-sm text-red-300">{errors.confirm_password}</p>
                        )}
                      </div>
                </div>
                </FormSection>
              )}

              {(!editingTeacher) && <div className="border-t border-white/10" />}

              <FormSection title="Professional Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label htmlFor="qualification" className="label-text">
                      Qualification
                    </label>
                    <input
                      type="text"
                      id="qualification"
                      name="qualification"
                      value={formData.qualification}
                      onChange={handleChange}
                      placeholder="e.g., B.Ed, M.A, Ph.D"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="specialization" className="label-text">
                      Specialization
                    </label>
                    <input
                      type="text"
                      id="specialization"
                      name="specialization"
                      value={formData.specialization}
                      onChange={handleChange}
                      placeholder="e.g., Mathematics, Science"
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label htmlFor="experience_years" className="label-text">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      id="experience_years"
                      name="experience_years"
                      value={formData.experience_years}
                      onChange={handleChange}
                      onBlur={() => handleBlur('experience_years')}
                      min="0"
                      placeholder="0"
                      className={`input-field ${fieldErrorClass(!!(touched.experience_years && errors.experience_years))}`}
                    />
                    {touched.experience_years && errors.experience_years && (
                      <p className="mt-1 text-sm text-red-600">{errors.experience_years}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="joining_date" className="label-text">
                      Joining Date
                    </label>
                    <input
                      type="date"
                      id="joining_date"
                      name="joining_date"
                      value={formData.joining_date}
                      onChange={handleChange}
                      onBlur={() => handleBlur('joining_date')}
                      className={`input-field ${fieldErrorClass(!!(touched.joining_date && errors.joining_date))}`}
                    />
                    {touched.joining_date && errors.joining_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.joining_date}</p>
                    )}
                  </div>
                </div>
              </FormSection>

              <div className="border-t border-white/10" />

              <FormSection title="Certificates">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="certificates" className="label-text">
                      Upload certificates (multiple files allowed)
                    </label>
                    <label className="btn-secondary cursor-pointer inline-flex mt-2">
                      Choose files
                      <input
                        type="file"
                        id="certificates"
                        name="certificates"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={handleCertificateChange}
                        className="hidden"
                      />
                    </label>
                    <p className="mt-2 meta-text text-sm">
                      PDF, JPG, PNG, DOC, DOCX — max 10 MB per file
                    </p>
                  </div>

                  {certificates.length > 0 && (
                    <div className="space-y-2">
                      <p className="label-text">Selected files</p>
                      {certificates.map((file, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/15 p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <svg className="w-5 h-5 text-white/70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm truncate">{file.name}</span>
                            <span className="text-xs text-white/50 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCertificate(index)}
                            className="text-red-300 hover:text-red-200 p-1"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
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
                  form="teacher-form"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isLoading || updateMutation.isLoading
                    ? editingTeacher ? 'Updating...' : 'Adding...'
                    : editingTeacher ? 'Update Teacher' : 'Add Teacher'}
                </button>
              </div>
        </AppModal>

        {/* View Teacher Modal */}
        {viewingTeacher && (
        <AppModal
          open
          onClose={() => {
            setViewingTeacher(null)
            setTeacherCertificates([])
          }}
          panelClassName="max-w-4xl"
          variant="opaque"
          labelledBy="teacher-view-title"
        >
              <div className="app-modal-header">
                <div>
                  <h2 id="teacher-view-title" className="modal-title">Teacher Profile</h2>
                  <p className="meta-text mt-1">Complete teacher record and certificates.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewingTeacher(null)
                    setTeacherCertificates([])
                  }}
                  className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="app-modal-body space-y-7">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-xl border border-white/15 bg-black/35 p-5">
                  <TeacherAvatar teacher={viewingTeacher} size="md" />
                  <div className="text-center sm:text-left min-w-0">
                    <h3 className="text-xl font-semibold text-white">{viewingTeacher.name}</h3>
                    <p className="text-sm text-white/60 font-mono mt-1">{viewingTeacher.employee_id}</p>
                  </div>
                </div>

                <FormSection title="Personal Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ViewDetailField label="Full Name" value={viewingTeacher.name} />
                    <ViewDetailField label="Email" value={viewingTeacher.email} />
                    <ViewDetailField label="Phone Number" value={viewingTeacher.phone} />
                    <ViewDetailField label="Employee ID" value={<span className="font-mono">{viewingTeacher.employee_id}</span>} />
                  </div>
                </FormSection>

                <FormSection title="Professional Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <ViewDetailField label="Qualification" value={viewingTeacher.qualification} />
                    <ViewDetailField label="Specialization" value={viewingTeacher.specialization} />
                    <ViewDetailField
                      label="Years of Experience"
                      value={
                        viewingTeacher.experience_years != null && viewingTeacher.experience_years !== ''
                          ? `${viewingTeacher.experience_years} years`
                          : null
                      }
                    />
                    <ViewDetailField
                      label="Joining Date"
                      value={
                        viewingTeacher.joining_date
                          ? new Date(viewingTeacher.joining_date).toLocaleDateString()
                          : null
                      }
                    />
                    <ViewDetailField label="Position" value={viewingTeacher.position} />
                    <ViewDetailField
                      label="Salary"
                      value={
                        viewingTeacher.salary != null && viewingTeacher.salary !== ''
                          ? formatMoney(viewingTeacher.salary, { compact: true })
                          : null
                      }
                    />
                    <ViewDetailField label="Branch" value={viewingTeacher.branch_name} />
                  </div>
                </FormSection>

                <FormSection title="Certificates">
                  {teacherCertificates.length > 0 ? (
                    <div className="space-y-3">
                      {teacherCertificates.map((cert: any) => (
                        <div
                          key={cert.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <svg className="w-8 h-8 text-amber-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{cert.file_name}</p>
                              <p className="text-xs text-white/55 mt-0.5">
                                {cert.file_size ? `${(cert.file_size / 1024 / 1024).toFixed(2)} MB` : ''}
                                {cert.file_size ? ' • ' : ''}
                                Uploaded: {new Date(cert.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`${API_URL.replace('/api', '')}${cert.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary text-sm py-2 shrink-0 text-center"
                          >
                            View
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="meta-text text-center py-6 rounded-lg border border-dashed border-white/15">
                      No certificates uploaded for this teacher.
                    </p>
                  )}
                </FormSection>
              </div>

              <div className="app-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setViewingTeacher(null)
                    setTeacherCertificates([])
                  }}
                  className="btn-secondary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewingTeacher(null)
                    setTeacherCertificates([])
                    handleEditTeacher(viewingTeacher)
                  }}
                  className="btn-primary"
                >
                  Edit Teacher
                </button>
              </div>
        </AppModal>
        )}

        {/* Import Modal */}
        <AppModal
          open={showImportModal}
          onClose={resetImportModal}
          panelClassName="max-w-2xl"
          labelledBy="import-teachers-title"
        >
              <div className="app-modal-header">
                <div>
                  <h2 id="import-teachers-title" className="modal-title">
                    Import Teachers
                  </h2>
                  <p className="meta-text mt-1">
                    Bulk register teachers via CSV using the template below.
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

              <div className="app-modal-body space-y-6">
                <FormSection title="Download Template">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-white/15 bg-black/35 p-4">
                    <p className="body-text text-sm">
                      Download a pre-formatted CSV with required columns and a sample row. Fill in teacher data and upload below.
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadTeacherImportTemplate()}
                      className="btn-primary shrink-0 gap-2"
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
                    <li>First row must contain column headers from the template</li>
                    <li>Required columns: Name, Email, Password</li>
                    <li>Optional: Employee ID (auto-generated if blank), Phone, Qualification, Specialization, Experience Years, Joining Date</li>
                    <li>All imported users are registered with the Teacher role</li>
                    <li>Password is used for initial login; teachers can change it later</li>
                  </ul>
                </div>

                {importProgress && (
                  <div className="alert-warning">{importProgress}</div>
                )}
              </div>

              <div className="app-modal-footer">
                <button type="button" onClick={resetImportModal} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!importFile) {
                      alert('Please select a file to import')
                      return
                    }
                    if (!user?.school_id) {
                      alert('School ID is required')
                      return
                    }
                    setImportProgress('Processing...')
                    importMutation.mutate(importFile)
                  }}
                  disabled={!importFile || importMutation.isLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importMutation.isLoading ? 'Importing...' : 'Import Teachers'}
                </button>
              </div>
        </AppModal>
      </div>
    </Layout>
  )
}
