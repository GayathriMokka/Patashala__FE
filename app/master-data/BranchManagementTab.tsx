'use client'


import SelectField from '@/components/SelectField'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import { useMutation, useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import { useEffect, useMemo, useRef, useState } from 'react'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterClearButton,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataStatusTag,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'
import { usePageExport } from '@/lib/usePageExport'
import { getSchoolLogoUrl } from '@/lib/schoolBranding'
import { getApiUrl } from '@/lib/api'
import { useSchoolBranding } from '@/contexts/SchoolBrandingContext'
import ImageCropModal, { LOGO_ASPECT_OPTIONS } from '@/components/ImageCropModal'

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

const BOARD_TYPES = ['CBSE', 'ICSE', 'State Board', 'IGCSE', 'IB', 'Other']
const SCHOOL_TYPES = ['Preschool', 'Primary', 'Secondary', 'Higher Secondary', 'Composite']

function normalizeBranchCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '-')
}

function isValidBranchCode(code: string) {
  return /^[A-Z0-9][A-Z0-9-]{0,29}$/.test(code)
}

const emptyForm = {
  name: '',
  code: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  pincode: '',
  board_type: 'CBSE',
  school_type: '',
  contact_person: '',
}

function branchStatusLabel(branch: {
  approval_status?: string
  is_active?: boolean
}) {
  if (branch.approval_status === 'pending') return 'Pending Approval'
  if (branch.approval_status === 'rejected') return 'Rejected'
  if (branch.is_active) return 'Active'
  return 'Inactive'
}

function branchStatusTone(branch: {
  approval_status?: string
  is_active?: boolean
}): 'active' | 'warning' | 'locked' | 'neutral' {
  if (branch.approval_status === 'pending') return 'warning'
  if (branch.approval_status === 'rejected') return 'locked'
  if (branch.is_active) return 'active'
  return 'neutral'
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-1 rounded-full bg-amber-400/90" aria-hidden />
        <h4 className="text-sm font-semibold uppercase tracking-wide text-white/90">{title}</h4>
      </div>
      {children}
    </section>
  )
}

interface BranchManagementTabProps {
  schoolId: number
}

export default function BranchManagementTab({ schoolId }: BranchManagementTabProps) {
  const { token } = useAuth()
  const { loadBranches, branch, setBranchSelection } = useBranch()
  const { refreshBranding } = useSchoolBranding()
  const queryClient = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)
  const cropSourceUrlRef = useRef<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingBranch, setEditingBranch] = useState<any>(null)
  const [viewBranch, setViewBranch] = useState<any>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null)
  const [cropFileName, setCropFileName] = useState('branch-logo.jpg')
  const [createInChargeLogin, setCreateInChargeLogin] = useState(true)
  const [inChargeAccount, setInChargeAccount] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterBoardTypes, setFilterBoardTypes] = useState<string[]>([])
  const [filterSchoolTypes, setFilterSchoolTypes] = useState<string[]>([])

  const { data: branches, isLoading } = useQuery(
    ['branches', schoolId],
    async () => {
      const response = await axios.get(`${getApiUrl()}/branches`, {
        params: { school_id: schoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data || []
    },
    { enabled: !!token && !!schoolId }
  )

  const statusFilterOptions = useMemo(
    () => [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'pending', label: 'Pending Approval' },
      { value: 'rejected', label: 'Rejected' },
    ],
    []
  )

  const boardFilterOptions = useMemo(
    () => BOARD_TYPES.map((board) => ({ value: board, label: board })),
    []
  )

  const schoolTypeFilterOptions = useMemo(
    () => SCHOOL_TYPES.map((type) => ({ value: type, label: type })),
    []
  )

  const resolveBranchStatusKey = (branch: {
    approval_status?: string
    is_active?: boolean
  }) => {
    if (branch.approval_status === 'pending') return 'pending'
    if (branch.approval_status === 'rejected') return 'rejected'
    if (branch.is_active) return 'active'
    return 'inactive'
  }

  const filteredBranches = useMemo(() => {
    return (branches || []).filter((branch: any) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
          branch.name?.toLowerCase().includes(searchLower) ||
          branch.code?.toLowerCase().includes(searchLower) ||
          branch.city?.toLowerCase().includes(searchLower) ||
          branch.contact_person?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }

      if (
        filterStatuses.length > 0 &&
        !filterStatuses.includes(resolveBranchStatusKey(branch))
      ) {
        return false
      }

      if (
        filterBoardTypes.length > 0 &&
        !filterBoardTypes.includes(String(branch.board_type || ''))
      ) {
        return false
      }

      if (
        filterSchoolTypes.length > 0 &&
        !filterSchoolTypes.includes(String(branch.school_type || ''))
      ) {
        return false
      }

      return true
    })
  }, [branches, searchTerm, filterStatuses, filterBoardTypes, filterSchoolTypes])

  const hasActiveFilters =
    !!searchTerm ||
    filterStatuses.length > 0 ||
    filterBoardTypes.length > 0 ||
    filterSchoolTypes.length > 0

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: { Authorization: `Bearer ${token}` },
    config: {
      mode: 'data',
      title: 'Branches',
      filename: 'branches',
      columns: [
        { key: 'name', label: 'Branch Name' },
        { key: 'code', label: 'Code' },
        { key: 'city', label: 'City' },
        { key: 'board_type', label: 'Board' },
        { key: 'school_type', label: 'School Type' },
        { key: 'status', label: 'Status' },
        { key: 'contact_person', label: 'Contact Person' },
      ],
      getRows: () =>
        filteredBranches.map((b: any) => ({
          name: b.name || '',
          code: b.code || '',
          city: b.city || '',
          board_type: b.board_type || '',
          school_type: b.school_type || '',
          status: resolveBranchStatusKey(b),
          contact_person: b.contact_person || '',
        })),
    },
  })

  const resetForm = () => {
    setFormData(emptyForm)
    setLogoFile(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setLogoPreview(null)
    setEditingBranch(null)
    setCreateInChargeLogin(true)
    setInChargeAccount({ name: '', email: '', password: '' })
    closeCropModal()
  }

  const closeCropModal = () => {
    setCropModalOpen(false)
    if (cropSourceUrlRef.current) {
      URL.revokeObjectURL(cropSourceUrlRef.current)
      cropSourceUrlRef.current = null
    }
    setCropSourceUrl(null)
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      if (cropSourceUrlRef.current) URL.revokeObjectURL(cropSourceUrlRef.current)
    }
  }, [])

  const openLogoCropper = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG or JPG).')
      return
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      alert('Logo file must be 2 MB or smaller.')
      return
    }

    closeCropModal()
    const sourceUrl = URL.createObjectURL(file)
    cropSourceUrlRef.current = sourceUrl
    setCropSourceUrl(sourceUrl)
    setCropFileName(file.name || 'branch-logo.jpg')
    setCropModalOpen(true)
  }

  const handleLogoChange = (file: File | undefined) => {
    if (!file) return
    openLogoCropper(file)
  }

  const handleCropComplete = (file: File, previewUrl: string) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    previewUrlRef.current = previewUrl
    setLogoFile(file)
    setLogoPreview(previewUrl)
    closeCropModal()
  }

  const handleRecropLogo = () => {
    if (logoFile) {
      openLogoCropper(logoFile)
      return
    }
    logoInputRef.current?.click()
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setLogoPreview(null)
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const createMutation = useMutation(
    async (payload: { form: typeof formData; inCharge?: typeof inChargeAccount }) => {
      const fd = new FormData()
      Object.entries(payload.form).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          fd.append(key, String(value))
        }
      })
      fd.append('school_id', String(schoolId))
      if (logoFile) fd.append('logo', logoFile)

      if (payload.inCharge?.name) fd.append('in_charge_name', payload.inCharge.name)
      if (payload.inCharge?.email) fd.append('in_charge_email', payload.inCharge.email)
      if (payload.inCharge?.password) fd.append('in_charge_password', payload.inCharge.password)

      const response = await axios.post(`${getApiUrl()}/branches`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },
    {
      onSuccess: async (data) => {
        queryClient.invalidateQueries(['branches'])
        await loadBranches()
        await refreshBranding()
        closeForm()
        alert(data?.message || 'Branch submitted successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create branch')
      },
    }
  )

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: typeof formData }) => {
      const fd = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          fd.append(key, String(value))
        }
      })
      if (logoFile) fd.append('logo', logoFile)

      const response = await axios.put(`${getApiUrl()}/branches/${id}`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      })
      return response.data
    },
    {
      onSuccess: async (_data, variables) => {
        queryClient.invalidateQueries(['branches'])
        await loadBranches()
        await refreshBranding()
        if (branch?.id === variables.id) {
          setBranchSelection({
            ...branch,
            code: variables.data.code,
            name: variables.data.name,
          })
        }
        closeForm()
        alert('Branch updated successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to update branch')
      },
    }
  )

  const statusMutation = useMutation(
    async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const response = await axios.post(
        `${getApiUrl()}/branches/${id}/status`,
        { is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    },
    {
      onSuccess: async () => {
        queryClient.invalidateQueries(['branches'])
        await loadBranches()
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to update branch status')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const response = await axios.post(
        `${getApiUrl()}/branches/${id}/delete`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    },
    {
      onSuccess: async (data) => {
        queryClient.invalidateQueries(['branches'])
        await loadBranches()
        alert(data?.message || 'Branch deleted successfully')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to delete branch')
      },
    }
  )

  const canDeleteBranch = (branch: { is_active?: boolean | number }) => !branch.is_active

  const handleDeleteBranch = (branch: { id: number; name: string }) => {
    const confirmed = confirm(
      `Are you sure you want to permanently delete branch "${branch.name}"?\n\nThis action cannot be undone.`
    )
    if (confirmed) {
      deleteMutation.mutate(branch.id)
    }
  }

  const handleEdit = (branch: any) => {
    if (branch.approval_status === 'pending') {
      alert('This branch is awaiting Super Admin approval and cannot be edited yet.')
      return
    }
    setEditingBranch(branch)
    setFormData({
      name: branch.name || '',
      code: branch.code || '',
      email: branch.email || '',
      phone: branch.phone || '',
      address: branch.address || '',
      city: branch.city || '',
      pincode: branch.pincode || '',
      board_type: branch.board_type || 'CBSE',
      school_type: branch.school_type || '',
      contact_person: branch.contact_person || '',
    })
    setLogoPreview(branch.logo_url ? getSchoolLogoUrl(branch.logo_url) : null)
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setLogoFile(null)
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const normalizedCode = normalizeBranchCode(formData.code)
    if (!formData.name.trim() || !normalizedCode) {
      alert('Branch name and code are required')
      return
    }
    if (!isValidBranchCode(normalizedCode)) {
      alert('Branch code must be 1-30 characters using letters, numbers, and hyphens only (e.g. FOW-KKP).')
      return
    }

    if (!editingBranch && createInChargeLogin) {
      if (!inChargeAccount.name.trim() || !inChargeAccount.email.trim() || !inChargeAccount.password.trim()) {
        alert('Branch In Charge name, email, and password are required when creating a login')
        return
      }
      if (inChargeAccount.password.length < 6) {
        alert('Branch In Charge password must be at least 6 characters')
        return
      }
    }

    const payload = { ...formData, code: normalizedCode }

    if (editingBranch && normalizedCode !== String(editingBranch.code || '').toUpperCase()) {
      const confirmed = window.confirm(
        'Changing the branch code updates auto-generated IDs that use {BRANCH} or {SCHOOL} in Master Data → ID Formats. Existing student and teacher IDs are not changed. Continue?'
      )
      if (!confirmed) return
    }

    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data: payload })
    } else {
      createMutation.mutate({
        form: payload,
        inCharge: createInChargeLogin ? inChargeAccount : undefined,
      })
    }
  }

  const isSaving = createMutation.isLoading || updateMutation.isLoading

  const branchCount = branches?.length || 0
  const filteredCount = filteredBranches.length

  return (
    <>
      {exportError ? (
        <div className="mb-2 text-xs text-red-200/90 px-2">{exportError}</div>
      ) : null}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
        >
          <div
            className="glass-card w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-form-title"
          >
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 shrink-0">
              <div>
                <h3 id="branch-form-title" className="modal-title">
                  {editingBranch ? 'Edit Branch' : 'Register New Branch'}
                </h3>
                <p className="meta-text mt-1">
                  {editingBranch
                    ? 'Update branch details and save changes.'
                    : 'Fill in the branch profile. All required fields are marked.'}
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

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {!editingBranch && (
                <div className="alert-warning flex items-start gap-3">
                  <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    A Branch In Charge role is created automatically for this branch with branch-scoped access.
                    After submission, the branch stays inactive until Super Admin approves it.
                  </p>
                </div>
              )}

              <form id="branch-form" onSubmit={handleSubmit} className="space-y-7">
                <FormSection title="Basic Information">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    <div>
                      <label htmlFor="branch-name" className="label-text">
                        Branch Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="branch-name"
                        type="text"
                        className="input-field"
                        placeholder="e.g. Downtown Campus"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="branch-code" className="label-text">
                        Branch Code <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="branch-code"
                        type="text"
                        className="input-field uppercase"
                        placeholder="e.g. FOW-KKP"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData({ ...formData, code: e.target.value.toUpperCase() })
                        }
                        required
                        maxLength={30}
                        pattern="[A-Z0-9][A-Z0-9-]*"
                        title="Letters, numbers, and hyphens only (e.g. FOW-KKP)"
                      />
                      <p className="text-xs text-white/50 mt-1">
                        Used in auto-generated IDs. Letters, numbers, and hyphens only.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="school-type" className="label-text">School Type</label>
                      <SelectField
                        id="school-type"
                        className="select-field"
                        value={formData.school_type}
                        onChange={(e) => setFormData({ ...formData, school_type: e.target.value })}
                      >
                        <option value="">Select type</option>
                        {SCHOOL_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label htmlFor="board-type" className="label-text">Board / Affiliation</label>
                      <SelectField
                        id="board-type"
                        className="select-field"
                        value={formData.board_type}
                        onChange={(e) => setFormData({ ...formData, board_type: e.target.value })}
                      >
                        {BOARD_TYPES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </SelectField>
                    </div>
                  </div>
                </FormSection>

                <div className="border-t border-white/10" />

                <FormSection title="Location">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="branch-address" className="label-text">Address</label>
                      <textarea
                        id="branch-address"
                        className="input-field resize-none min-h-[88px]"
                        rows={3}
                        placeholder="Street, area, landmark"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                      <div>
                        <label htmlFor="branch-city" className="label-text">City</label>
                        <input
                          id="branch-city"
                          type="text"
                          className="input-field"
                          placeholder="City name"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor="branch-pincode" className="label-text">Pincode</label>
                        <input
                          id="branch-pincode"
                          type="text"
                          inputMode="numeric"
                          className="input-field"
                          placeholder="6-digit pincode"
                          value={formData.pincode}
                          onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </FormSection>

                <div className="border-t border-white/10" />

                <FormSection title="Contact Details">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                    <div>
                      <label htmlFor="branch-email" className="label-text">Email</label>
                      <input
                        id="branch-email"
                        type="email"
                        className="input-field"
                        placeholder="branch@school.edu"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="branch-phone" className="label-text">Phone</label>
                      <input
                        id="branch-phone"
                        type="tel"
                        className="input-field"
                        placeholder="+91 XXXXX XXXXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="contact-person" className="label-text">Contact Person</label>
                      <input
                        id="contact-person"
                        type="text"
                        className="input-field"
                        placeholder="Primary contact name"
                        value={formData.contact_person}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      />
                    </div>
                  </div>
                </FormSection>

                <div className="border-t border-white/10" />

                <FormSection title="Branding">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
                    <div className="space-y-3">
                      <label className="label-text">Branch Logo</label>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="sr-only"
                        onChange={(e) => handleLogoChange(e.target.files?.[0])}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="w-full rounded-xl border border-dashed border-white/25 bg-black/20 px-4 py-8 text-center transition-colors hover:border-white/40 hover:bg-black/30"
                      >
                        <svg className="mx-auto h-8 w-8 text-white/50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium text-white/90">
                          {logoPreview ? 'Click to replace logo' : 'Click to upload logo'}
                        </p>
                        <p className="text-xs text-white/50 mt-1">PNG, JPG, WEBP up to 2 MB · crop before upload</p>
                        {logoFile && (
                          <p className="text-xs text-emerald-300 mt-2 truncate">{logoFile.name}</p>
                        )}
                      </button>

                      {logoPreview && (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary text-xs px-3 py-2" onClick={handleRecropLogo}>
                            Adjust crop
                          </button>
                          <button
                            type="button"
                            className="text-xs px-3 py-2 rounded-lg border border-red-400/30 text-red-200 hover:bg-red-500/15 transition-colors"
                            onClick={handleRemoveLogo}
                          >
                            Remove logo
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center sm:items-end">
                      <span className="label-text mb-2">Preview</span>
                      <div className="h-28 w-28 rounded-xl border border-white/20 bg-black/25 flex items-center justify-center overflow-hidden shadow-inner">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo preview" className="h-full w-full object-contain p-2" />
                        ) : (
                          <span className="text-xs text-white/40 text-center px-2">No logo</span>
                        )}
                      </div>
                      {logoFile && (
                        <p className="text-[11px] text-white/45 mt-2 text-center sm:text-right">Cropped & optimized</p>
                      )}
                    </div>
                  </div>
                </FormSection>

                {!editingBranch && (
                  <>
                    <div className="border-t border-white/10" />

                    <FormSection title="Branch In Charge Access">
                      <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        The Branch In Charge role is provisioned automatically for this branch. You can create the login now or assign a user later from User Management.
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createInChargeLogin}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setCreateInChargeLogin(checked)
                            if (checked) {
                              setInChargeAccount((prev) => ({
                                ...prev,
                                name: prev.name || formData.contact_person,
                                email: prev.email || formData.email,
                              }))
                            }
                          }}
                          className="mt-1 h-4 w-4 rounded border-white/30 bg-black/30 text-blue-500 focus:ring-blue-400/40"
                        />
                        <span>
                          <span className="block text-sm font-medium text-white/90">Create Branch In Charge login now</span>
                          <span className="block text-xs text-white/55 mt-0.5">
                            Uses branch-scoped permissions. Login activates when the branch is approved.
                          </span>
                        </span>
                      </label>

                      {createInChargeLogin && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                          <div className="sm:col-span-2">
                            <label htmlFor="in-charge-name" className="label-text">
                              In Charge Name <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="in-charge-name"
                              type="text"
                              className="input-field"
                              placeholder="Branch administrator name"
                              value={inChargeAccount.name}
                              onChange={(e) => setInChargeAccount({ ...inChargeAccount, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label htmlFor="in-charge-email" className="label-text">
                              Login Email <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="in-charge-email"
                              type="email"
                              className="input-field"
                              placeholder="incharge@branch.edu"
                              value={inChargeAccount.email}
                              onChange={(e) => setInChargeAccount({ ...inChargeAccount, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <label htmlFor="in-charge-password" className="label-text">
                              Temporary Password <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="in-charge-password"
                              type="password"
                              className="input-field"
                              placeholder="Minimum 6 characters"
                              value={inChargeAccount.password}
                              onChange={(e) => setInChargeAccount({ ...inChargeAccount, password: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </FormSection>
                  </>
                )}
              </form>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 border-t border-white/10 shrink-0 bg-black/15">
              <button type="button" className="btn-secondary" onClick={closeForm}>
                Cancel
              </button>
              <button type="submit" form="branch-form" className="btn-primary" disabled={isSaving}>
                {isSaving
                  ? 'Saving...'
                  : editingBranch
                    ? 'Update Branch'
                    : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
        >
          <div
            className="glass-card w-full max-w-lg p-6 space-y-5 shadow-2xl"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="modal-title">{viewBranch.name}</h3>
                <p className="meta-text mt-1">Branch code: {viewBranch.code}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => setViewBranch(null)}
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Status</p>
                <MasterDataStatusTag
                  label={branchStatusLabel(viewBranch)}
                  tone={branchStatusTone(viewBranch)}
                  active={viewBranch.is_active}
                />
              </div>
              <div>
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Board</p>
                <p className="body-text">{viewBranch.board_type || '—'}</p>
              </div>
              <div>
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Type</p>
                <p className="body-text">{viewBranch.school_type || '—'}</p>
              </div>
              <div>
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Contact</p>
                <p className="body-text">{viewBranch.contact_person || '—'}</p>
              </div>
              <div>
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Email</p>
                <p className="body-text break-all">{viewBranch.email || '—'}</p>
              </div>
              <div>
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Phone</p>
                <p className="body-text">{viewBranch.phone || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-white/55 text-xs uppercase tracking-wide mb-1">Address</p>
                <p className="body-text">
                  {[viewBranch.address, viewBranch.city, viewBranch.pincode].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <MasterDataTabShell
        title="Branch Management"
        subtitle={`${filteredCount} branch${filteredCount === 1 ? '' : 'es'}${filteredCount !== branchCount ? ` of ${branchCount}` : ''}`}
        toolbarActions={
          <>
            <ExportMenu
              onExport={handleExport}
              isExporting={isExporting}
              recordCount={filteredCount}
            />
            <MasterDataToolbarBtn
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Branch</span>
            </MasterDataToolbarBtn>
          </>
        }
        filters={
          <>
            <PageFilterSearch
              id="branch_search"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Branch name, code, city..."
              hideLabel
              className="master-data-tab-select-wide flex-1 min-w-0"
            />
            <PageFilterField id="filter_branch_status" label="Status" hideLabel className="master-data-tab-select">
              <MultiSelectDropdown
                id="filter_branch_status"
                options={statusFilterOptions}
                value={filterStatuses}
                onChange={setFilterStatuses}
                placeholder="Status"
                aria-label="Filter by branch status"
              />
            </PageFilterField>
            <PageFilterField id="filter_branch_board" label="Board" hideLabel className="master-data-tab-select">
              <MultiSelectDropdown
                id="filter_branch_board"
                options={boardFilterOptions}
                value={filterBoardTypes}
                onChange={setFilterBoardTypes}
                placeholder="Board"
                aria-label="Filter by board"
              />
            </PageFilterField>
            <PageFilterField id="filter_branch_school_type" label="School Type" hideLabel className="master-data-tab-select-wide">
              <MultiSelectDropdown
                id="filter_branch_school_type"
                options={schoolTypeFilterOptions}
                value={filterSchoolTypes}
                onChange={setFilterSchoolTypes}
                placeholder="School Type"
                aria-label="Filter by school type"
              />
            </PageFilterField>
            {hasActiveFilters ? (
              <PageFilterClearButton
                onClick={() => {
                  setSearchTerm('')
                  setFilterStatuses([])
                  setFilterBoardTypes([])
                  setFilterSchoolTypes([])
                }}
              />
            ) : null}
          </>
        }
        footer={
          filteredCount
            ? `Showing ${filteredCount}${filteredCount !== branchCount ? ` of ${branchCount}` : ''} records`
            : undefined
        }
      >
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading…</div>
        ) : !branchCount ? (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
            No branches found. Click <strong className="text-white/75">Add Branch</strong> to create one.
          </div>
        ) : filteredCount ? (
          <MasterDataDenseTable>
            <table className="data-table data-table-fit w-full">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Code</th>
                  <th>Contact</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Act.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredBranches.map((b: any) => (
                  <tr key={b.id} className="master-data-table-row hover:bg-white/[0.04]">
                    <td className="max-w-0">
                      <span className="md-cell-text font-medium text-white" title={b.name}>
                        {b.name}
                      </span>
                    </td>
                    <td className="max-w-0">
                      <span className="md-cell-text font-mono text-white/85" title={b.code}>
                        {b.code}
                      </span>
                    </td>
                    <td className="max-w-0">
                      <span
                        className="md-cell-text text-white/70"
                        title={b.phone || b.email || b.contact_person || undefined}
                      >
                        {b.phone || b.email || b.contact_person || '—'}
                      </span>
                    </td>
                    <td className="text-center">
                      <MasterDataStatusTag
                        label={branchStatusLabel(b)}
                        tone={branchStatusTone(b)}
                        active={b.is_active}
                      />
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button
                          type="button"
                          className="md-action-link md-action-edit"
                          onClick={() => setViewBranch(b)}
                        >
                          View
                        </button>
                        {b.approval_status !== 'pending' && b.approval_status !== 'rejected' && (
                          <button
                            type="button"
                            className="md-action-link md-action-edit"
                            onClick={() => handleEdit(b)}
                          >
                            Edit
                          </button>
                        )}
                        {b.approval_status === 'approved' && (
                          <button
                            type="button"
                            className="md-action-link"
                            onClick={() => {
                              if (confirm(`${b.is_active ? 'Deactivate' : 'Activate'} branch "${b.name}"?`)) {
                                statusMutation.mutate({ id: b.id, is_active: !b.is_active })
                              }
                            }}
                          >
                            {b.is_active ? 'Off' : 'On'}
                          </button>
                        )}
                        {canDeleteBranch(b) && (
                          <button
                            type="button"
                            className="md-action-link md-action-delete"
                            onClick={() => handleDeleteBranch(b)}
                            disabled={deleteMutation.isLoading}
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MasterDataDenseTable>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
            No branches match the selected filters.
          </div>
        )}
      </MasterDataTabShell>

      <ImageCropModal
        open={cropModalOpen}
        imageSrc={cropSourceUrl}
        fileName={cropFileName}
        title="Crop Branch Logo"
        subtitle="Use Original for full logo width. Drag to reposition and zoom out if you need more of the image inside the frame."
        aspectOptions={LOGO_ASPECT_OPTIONS}
        defaultAspectId="original"
        variant="logo"
        outputSize={1024}
        onClose={closeCropModal}
        onComplete={handleCropComplete}
      />
    </>
  )
}
