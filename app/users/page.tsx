'use client'

import Layout from '@/components/Layout'
import SelectField from '@/components/SelectField'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  filterSchoolUserRoles,
  getRoleDisplayLabel,
  getRoleTabIcon,
  getRoleTabLabel,
  isDriverRole,
  toRoleTabId,
} from '@/lib/schoolUserRoles'
import { buildBranchScopedHeaders, canSwitchBranches, getBranchScopeKey } from '@/lib/branchAccess'
import { isBranchAssignableRole, isSchoolWideRole } from '@/lib/branchUserRoles'
import EmailOtpVerify from '@/components/EmailOtpVerify'
import { useOtpEnforced } from '@/lib/useOtpEnforced'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterBar,
  PageFilterClearButton,
  PageFilterField,
  PageFilterRow,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

const PARENT_TAB_ID = toRoleTabId('Parent')

type BranchRow = { id: number; name: string; code: string; is_main_branch?: boolean }

function resolveUserBranchDisplay(
  userItem: { role_name?: string; branch_id?: number | null; branch_name?: string | null; branch_code?: string | null },
  branches: BranchRow[] | undefined
) {
  if (userItem.branch_id && branches?.length) {
    const matched = branches.find((b) => b.id === userItem.branch_id)
    if (matched) {
      return { kind: 'branch' as const, name: matched.name, code: matched.code }
    }
  }

  if (userItem.branch_name) {
    return {
      kind: 'branch' as const,
      name: userItem.branch_name,
      code: userItem.branch_code || '',
    }
  }

  const role = userItem.role_name || ''

  if (isSchoolWideRole(role)) {
    return { kind: 'all' as const, label: 'All Branches' }
  }

  if (role === 'Parent') {
    return { kind: 'schoolwide' as const, label: 'Cross-branch' }
  }

  if (isBranchAssignableRole(role)) {
    return { kind: 'unassigned' as const, label: 'Not assigned' }
  }

  return { kind: 'unassigned' as const, label: 'Not assigned' }
}

function userMatchesSelectedBranch(
  userItem: { role_name?: string; branch_id?: number | null },
  branchId: number
) {
  if (isSchoolWideRole(userItem.role_name)) return true
  if (userItem.role_name === 'Parent') return true
  const assignedBranch =
    userItem.branch_id != null && userItem.branch_id !== '' ? Number(userItem.branch_id) : null
  return assignedBranch === branchId
}

function UserBranchCell({
  userItem,
  branches,
}: {
  userItem: { role_name?: string; branch_id?: number | null; branch_name?: string | null; branch_code?: string | null }
  branches: BranchRow[] | undefined
}) {
  const display = resolveUserBranchDisplay(userItem, branches)

  if (display.kind === 'branch') {
    return (
      <span className="inline-flex max-w-[11rem] items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/20 px-2.5 py-2">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-xs font-semibold text-amber-50">{display.name}</span>
          <span className="block truncate text-[10px] font-medium text-amber-200/90">{display.code}</span>
        </span>
      </span>
    )
  }

  if (display.kind === 'all') {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-violet-400/35 bg-violet-500/20 px-2.5 py-2 text-xs font-semibold text-violet-100">
        <svg className="h-4 w-4 shrink-0 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {display.label}
      </span>
    )
  }

  if (display.kind === 'schoolwide') {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/15 px-2.5 py-2 text-xs font-medium text-sky-100">
        {display.label}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-xs font-medium text-white/75">
      {display.label}
    </span>
  )
}

export default function UsersPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { branch, isAllBranches, isLoading: branchLoading } = useBranch()
  const queryClient = useQueryClient()
  const otpEnforced = useOtpEnforced()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [passwordData, setPasswordData] = useState<any>(null)
  const [parentFilters, setParentFilters] = useState({
    class_id: '',
    section_id: '',
  })
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    role_id: '',
    branch_id: '',
    student_id: '',
    parent_type: '',
    license_number: '',
    license_expiry: '',
  })
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [showStudentDropdown, setShowStudentDropdown] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [emailVerificationToken, setEmailVerificationToken] = useState('')

  const handleEmailVerified = useCallback((token: string) => {
    setEmailVerificationToken(token)
  }, [])

  const handleEmailVerificationReset = useCallback(() => {
    setEmailVerificationToken('')
  }, [])

  // Fetch roles
  const { data: roles } = useQuery(
    ['roles'],
    async () => {
      const response = await axios.get(`${API_URL}/users/roles/list`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data
    },
    { enabled: !!token }
  )

  const { data: branches } = useQuery(
    ['branches', user?.school_id],
    async () => {
      const response = await axios.get(`${API_URL}/branches`, {
        params: { school_id: user?.school_id, active_only: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data || []
    },
    { enabled: !!token && !!user?.school_id }
  )

  const branchScopeKey = getBranchScopeKey(branch?.id, isAllBranches)
  const branchQueryReady =
    !branchLoading &&
    (!canSwitchBranches(user?.role_name) || isAllBranches || !!branch?.id)

  const scopedHeaders = useMemo(
    () =>
      buildBranchScopedHeaders(token || '', {
        academicYearId: academicYear?.id,
        branchId: branch?.id,
        isAllBranches,
      }),
    [token, academicYear?.id, branch?.id, isAllBranches]
  )

  // Fetch classes
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
    { enabled: !!token && !!user?.school_id && !!academicYear?.id && !branchLoading }
  )

  // Fetch sections
  const { data: sections } = useQuery(
    ['sections', user?.school_id, academicYear?.id, parentFilters.class_id, branchScopeKey],
    async () => {
      if (!parentFilters.class_id) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          class_id: parentFilters.class_id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!token && !!user?.school_id && !!academicYear?.id && !!parentFilters.class_id && !branchLoading }
  )

  // Fetch students for parent registration
  const { data: students } = useQuery(
    ['students', user?.school_id, academicYear?.id, studentSearchTerm, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/students`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          search: studentSearchTerm,
        },
        headers: scopedHeaders,
      })
      return response.data.data || []
    },
    { enabled: !!token && !!user?.school_id && !!academicYear?.id && !branchLoading }
  )

  const schoolRoles = useMemo(() => filterSchoolUserRoles(roles || []), [roles])

  const showBranchColumn = Boolean(user?.school_id)

  const tabs = useMemo(
    () => [
      { id: 'all', label: 'All Users', icon: '👥', roleName: null as string | null },
      ...schoolRoles.map((role: { id: number; name: string }) => ({
        id: toRoleTabId(role.name),
        label: getRoleTabLabel(role.name),
        icon: getRoleTabIcon(role.name),
        roleName: role.name,
      })),
    ],
    [schoolRoles]
  )

  const activeRoleName =
    activeTab === 'all' ? null : tabs.find((tab) => tab.id === activeTab)?.roleName ?? null
  const isParentTab = activeTab === PARENT_TAB_ID

  useEffect(() => {
    if (activeTab !== 'all' && tabs.length > 0 && !tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('all')
    }
  }, [activeTab, tabs])

  // Get selected role name
  const selectedRole = schoolRoles.find((r: any) => r.id === parseInt(formData.role_id))
  const isParentRole = selectedRole?.name === 'Parent'
  const isDriverRoleSelected = isDriverRole(selectedRole?.name)
  const needsBranchAssignment = isBranchAssignableRole(selectedRole?.name)
  const branchSelectionRequired = needsBranchAssignment
  const studentDropdownRef = useRef<HTMLDivElement>(null)

  const defaultBranchIdForCreate = useMemo(() => {
    if (!isAllBranches && branch?.id) return String(branch.id)
    const first = (branches as BranchRow[] | undefined)?.[0]
    return first ? String(first.id) : ''
  }, [branch?.id, branches, isAllBranches])

  const openCreateModal = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      phone: '',
      role_id: '',
      branch_id: defaultBranchIdForCreate,
      student_id: '',
      parent_type: '',
      license_number: '',
      license_expiry: '',
    })
    setSelectedStudent(null)
    setStudentSearchTerm('')
    setShowStudentDropdown(false)
    setShowCreateModal(true)
  }

  // Close student dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target as Node)) {
        setShowStudentDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch users based on active tab
  const { data: users, isLoading } = useQuery(
    ['users', user?.school_id, activeTab, parentFilters.class_id, parentFilters.section_id, academicYear?.id, branchScopeKey],
    async () => {
      const params: any = {}

      // Super Admin can see all users, others only their school
      if (user?.role_name !== 'Super Admin' && user?.school_id) {
        params.school_id = user.school_id
      } else if (user?.school_id) {
        params.school_id = user.school_id
      }

      // Add academic year for parent filtering
      if (academicYear?.id) {
        params.academic_year_id = academicYear.id
      }

      if (activeRoleName) {
        params.role_name = activeRoleName
      }

      // Add class and section filters for parents
      if (isParentTab) {
        if (parentFilters.class_id) {
          params.class_id = parentFilters.class_id
        }
        if (parentFilters.section_id) {
          params.section_id = parentFilters.section_id
        }
      }

      const response = await axios.get(`${API_URL}/users`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!token && branchQueryReady }
  )

  // Create user mutation
  const createUserMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/users`,
        {
          ...data,
          school_id: user?.school_id,
        },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['users'])
        setShowCreateModal(false)
        setFormData({
          email: '',
          password: '',
          name: '',
          phone: '',
          role_id: '',
          branch_id: '',
          student_id: '',
          parent_type: '',
          license_number: '',
          license_expiry: '',
        })
        setSelectedStudent(null)
        setStudentSearchTerm('')
        setShowStudentDropdown(false)
        setEmailVerificationToken('')
        alert('User created successfully!')
      },
      onError: (error: any) => {
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          'Failed to create user'
        alert(errorMessage)
      },
    }
  )

  // Delete user mutation
  const deleteUserMutation = useMutation(
    async (userId: number) => {
      const response = await axios.delete(`${API_URL}/users/${userId}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['users'])
        alert('User deleted successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to delete user')
      },
    }
  )

  // Reset password mutation
  const resetPasswordMutation = useMutation(
    async ({ userId, generate }: { userId: number; generate: boolean }) => {
      const response = await axios.post(
        `${API_URL}/users/${userId}/reset-password`,
        {
          generate_password: generate,
          new_password: generate ? undefined : formData.password,
        },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        setPasswordData(data.data)
        setShowPasswordModal(true)
        queryClient.invalidateQueries(['users'])
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to reset password')
      },
    }
  )

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.name || !formData.role_id) {
      alert('Please fill in all required fields')
      return
    }
    if (!formData.password) {
      alert('Please provide a password')
      return
    }
    
    // Validate parent-specific fields
    if (isParentRole) {
      if (!formData.student_id) {
        alert('Please select a student for parent registration')
        return
      }
      if (!formData.parent_type) {
        alert('Please select parent type (Father/Mother/Guardian)')
        return
      }
    }

    if (isDriverRoleSelected) {
      if (!formData.license_number.trim()) {
        alert('Driving license number is required for Van Driver accounts')
        return
      }
      if (!formData.phone.trim()) {
        alert('Phone number is required for Van Driver accounts')
        return
      }
    }

    if (needsBranchAssignment && !formData.branch_id) {
      alert('Please select a branch for this user')
      return
    }

    if (otpEnforced && !emailVerificationToken) {
      alert('Please verify the email address with OTP before creating the user.')
      return
    }

    const payload: any = {
      email: formData.email,
      password: formData.password,
      name: formData.name,
      phone: formData.phone,
      role_id: formData.role_id,
      branch_id: formData.branch_id,
    }
    if (otpEnforced && emailVerificationToken) {
      payload.email_verification_token = emailVerificationToken
    }

    if (isParentRole) {
      payload.student_id = formData.student_id
      payload.parent_type = formData.parent_type
    }

    if (isDriverRoleSelected) {
      payload.license_number = formData.license_number.trim()
      if (formData.license_expiry) {
        payload.license_expiry = formData.license_expiry
      }
    }

    createUserMutation.mutate(payload)
  }

  const handleDelete = (userId: number, userName: string) => {
    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      deleteUserMutation.mutate(userId)
    }
  }

  const handleResetPassword = (userId: number, generate: boolean = false) => {
    if (!generate && !formData.password) {
      alert('Please enter a new password or select "Generate Password"')
      return
    }
    resetPasswordMutation.mutate({ userId, generate })
  }

  const filteredUsers = useMemo(() => {
    const list = users || []
    if (isAllBranches || !branch?.id) return list
    return list.filter((userItem: { role_name?: string; branch_id?: number | null }) =>
      userMatchesSelectedBranch(userItem, branch.id)
    )
  }, [users, branch, isAllBranches])

  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label || 'All Users'

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Users',
      filename: 'users',
      getSubtitle: () => `Role: ${activeTabLabel}`,
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role_name', label: 'Role' },
        { key: 'branch_name', label: 'Branch' },
        { key: 'phone', label: 'Phone' },
        { key: 'is_active', label: 'Active' },
      ],
      getRows: () =>
        filteredUsers.map((u: any) => ({
          name: u.name || '',
          email: u.email || '',
          role_name: u.role_name || '',
          branch_name: u.branch_name || '',
          phone: u.phone || '',
          is_active: u.is_active ? 'Yes' : 'No',
        })),
    },
  })

  return (
    <Layout>
      <div className="users-page-layout">
        {/* Toolbar: role filters + create action */}
        <div className="glass-card p-2 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3 shrink-0">
          <div className="flex flex-1 flex-nowrap min-w-0 gap-1" role="tablist" aria-label="Filter users by role">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  if (tab.id !== PARENT_TAB_ID) {
                    setParentFilters({ class_id: '', section_id: '' })
                  }
                }}
                title={tab.roleName || 'All Users'}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 px-1 transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-500/35 text-white border border-blue-300/40 shadow-md'
                    : 'text-white/75 border border-transparent hover:bg-white/10 hover:border-white/15'
                }`}
              >
                <span className="text-base sm:text-lg leading-none" aria-hidden>
                  {tab.icon}
                </span>
                <span className="w-full truncate text-center text-[10px] sm:text-[11px] font-medium leading-tight px-0.5">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary shrink-0 flex items-center justify-center gap-2 px-4 sm:min-w-[9.5rem]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">Create User</span>
          </button>
          <ExportMenu
            onExport={handleExport}
            isExporting={isExporting}
            recordCount={filteredUsers.length}
            size="sm"
          />
        </div>
        {exportError && (
          <p className="text-xs text-red-200 px-2" role="alert">
            {exportError}
          </p>
        )}

        {/* Parent Filters - Class and Section */}
        {isParentTab && (
          <PageFilterBar className="shrink-0">
            <PageFilterRow>
              <PageFilterField label="Class">
                <SelectField
                  value={parentFilters.class_id}
                  onChange={(e) => {
                    setParentFilters({
                      class_id: e.target.value,
                      section_id: '',
                    })
                  }}
                  className="select-field"
                >
                  <option value="">All Classes</option>
                  {classes?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </SelectField>
              </PageFilterField>

              <PageFilterField label="Section">
                <SelectField
                  value={parentFilters.section_id}
                  onChange={(e) => setParentFilters({ ...parentFilters, section_id: e.target.value })}
                  disabled={!parentFilters.class_id}
                  className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Sections</option>
                  {sections?.map((sec: any) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </SelectField>
              </PageFilterField>

              {parentFilters.class_id || parentFilters.section_id ? (
                <PageFilterClearButton
                  onClick={() => setParentFilters({ class_id: '', section_id: '' })}
                />
              ) : null}
            </PageFilterRow>
          </PageFilterBar>
        )}

        {/* Users Table */}
        <div className="table-shell users-page-table">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center py-12 meta-text">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12 meta-text">No users found for this branch and role filter.</div>
          ) : (
            <div className="users-table-scroll">
              <table className="data-table w-full">
                <thead>
                <tr>
                  <th className="users-col-name">Name</th>
                  <th className="users-col-email">Email</th>
                  <th className="users-col-phone">Phone</th>
                  {isParentTab && <th>Student(s)</th>}
                  {showBranchColumn && <th className="users-col-branch">Branch</th>}
                  <th className="users-col-role">Role</th>
                  <th className="users-col-status">Status</th>
                  <th className="users-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userItem: any) => (
                  <tr key={userItem.id}>
                    <td className="font-medium users-col-name">{userItem.name}</td>
                    <td className="users-col-email truncate" title={userItem.email}>{userItem.email}</td>
                    <td className="users-col-phone">{userItem.phone || '—'}</td>
                    {isParentTab && (
                      <td>
                        {userItem.student_names ? (
                          <span className="text-xs">{userItem.student_names}</span>
                        ) : (
                          <span className="text-xs text-white/45">No students linked</span>
                        )}
                        {userItem.class_sections && (
                          <div className="text-xs text-white/55 mt-1">({userItem.class_sections})</div>
                        )}
                      </td>
                    )}
                    {showBranchColumn && (
                      <td className="users-col-branch align-top">
                        <UserBranchCell userItem={userItem} branches={branches} />
                      </td>
                    )}
                    <td className="users-col-role">
                      <span className="badge-info">{userItem.role_name}</span>
                    </td>
                    <td className="users-col-status">
                      <span className={userItem.is_active ? 'badge-success' : 'badge-danger'}>
                        {userItem.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="users-col-actions">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(userItem)
                            setFormData({ ...formData, password: '' })
                            setShowPasswordModal(true)
                          }}
                          className="p-1.5 rounded-lg text-blue-300 hover:bg-white/10 transition-colors"
                          title="Reset Password"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(userItem.id, userItem.name)}
                          disabled={userItem.id === user?.id}
                          className="p-1.5 rounded-lg text-red-300 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={userItem.id === user?.id ? 'Cannot delete yourself' : 'Delete User'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="glass-card p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="page-title">Create New User</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setFormData({
                      email: '',
                      password: '',
                      name: '',
                      phone: '',
                      role_id: '',
                      branch_id: '',
                      student_id: '',
                      parent_type: '',
                      license_number: '',
                      license_expiry: '',
                    })
                    setSelectedStudent(null)
                    setStudentSearchTerm('')
                    setShowStudentDropdown(false)
                  }}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="label-text mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field placeholder-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="label-text mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value })
                      setEmailVerificationToken('')
                    }}
                    className="input-field placeholder-slate-400"
                    required
                  />
                  <EmailOtpVerify
                    email={formData.email}
                    purpose="registration"
                    onVerified={handleEmailVerified}
                    onReset={handleEmailVerificationReset}
                  />
                </div>

                <div>
                  <label className="label-text mb-2">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="input-field placeholder-slate-400"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="label-text mb-2">
                    Phone{isDriverRoleSelected ? ' *' : ''}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field placeholder-slate-400"
                    required={isDriverRoleSelected}
                  />
                </div>

                <div>
                  <label className="label-text mb-2">Role *</label>
                  <SelectField
                    value={formData.role_id}
                    onChange={(e) => {
                      const newRoleId = e.target.value
                      const newRole = schoolRoles.find((r: { id: number }) => r.id === parseInt(newRoleId, 10))
                      const assignBranch = isBranchAssignableRole(newRole?.name)
                      setFormData({
                        ...formData,
                        role_id: newRoleId,
                        branch_id: assignBranch
                          ? formData.branch_id || defaultBranchIdForCreate
                          : '',
                        student_id: '',
                        parent_type: '',
                        license_number: '',
                        license_expiry: '',
                      })
                      setSelectedStudent(null)
                      setStudentSearchTerm('')
                    }}
                    className="select-field"
                    required
                  >
                    <option value="">Select Role</option>
                    {schoolRoles.map((role: any) => (
                      <option key={role.id} value={role.id}>
                        {getRoleDisplayLabel(role.name)}
                      </option>
                    ))}
                  </SelectField>
                </div>

                {needsBranchAssignment && (
                  <div>
                    <label className="label-text mb-2">Registered Branch *</label>
                    <SelectField
                      value={formData.branch_id}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="select-field"
                      required={branchSelectionRequired}
                    >
                      <option value="">Select Branch</option>
                      {(branches || []).map((branchOption: { id: number; name: string; code: string }) => (
                        <option key={branchOption.id} value={branchOption.id}>
                          {branchOption.name} ({branchOption.code})
                        </option>
                      ))}
                    </SelectField>
                    <p className="meta-text mt-1.5">
                      User will only see data for this branch across fees, expenses, revenue, and other modules.
                    </p>
                  </div>
                )}

                {isDriverRoleSelected && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
                    Van Driver logins can access the Transport module to run trips, fuel logs, and
                    maintenance requests. Register their driving license below.
                  </div>
                )}

                {isDriverRoleSelected && (
                  <>
                    <div>
                      <label className="label-text mb-2">Driving license number *</label>
                      <input
                        type="text"
                        value={formData.license_number}
                        onChange={(e) =>
                          setFormData({ ...formData, license_number: e.target.value })
                        }
                        className="input-field placeholder-slate-400"
                        placeholder="e.g. DL-0420190012345"
                        required
                      />
                    </div>
                    <div>
                      <label className="label-text mb-2">License expiry</label>
                      <input
                        type="date"
                        value={formData.license_expiry}
                        onChange={(e) =>
                          setFormData({ ...formData, license_expiry: e.target.value })
                        }
                        className="input-field"
                      />
                    </div>
                  </>
                )}

                {/* Student Selection for Parents */}
                {isParentRole && (
                  <>
                    <div>
                      <label className="label-text mb-2">Student *</label>
                      <div className="relative" ref={studentDropdownRef}>
                        <input
                          type="text"
                          value={studentSearchTerm}
                          onChange={(e) => {
                            setStudentSearchTerm(e.target.value)
                            setShowStudentDropdown(true)
                          }}
                          onFocus={() => setShowStudentDropdown(true)}
                          placeholder="Search student by name or admission number..."
                          className="input-field placeholder-slate-400"
                          required={isParentRole}
                        />
                        {showStudentDropdown && students && students.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl dropdown-options-scroll dropdown-options-scroll-two-line dropdown-options-scroll-light">
                            {students
                              .filter((student: any) => {
                                if (!studentSearchTerm) return true
                                const searchLower = studentSearchTerm.toLowerCase()
                                const fullName = `${student.first_name} ${student.last_name || ''}`.toLowerCase()
                                const admissionNumber = (student.admission_number || '').toLowerCase()
                                return fullName.includes(searchLower) || admissionNumber.includes(searchLower)
                              })
                              .slice(0, 10)
                              .map((student: any) => (
                                <button
                                  key={student.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudent(student)
                                    setFormData({ ...formData, student_id: student.id.toString() })
                                    setStudentSearchTerm(`${student.first_name} ${student.last_name || ''} (${student.admission_number})`)
                                    setShowStudentDropdown(false)
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors text-slate-900"
                                >
                                  <div className="font-medium">
                                    {student.first_name} {student.last_name || ''}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Admission: {student.admission_number}
                                  </div>
                                </button>
                              ))}
                            {students.filter((student: any) => {
                              if (!studentSearchTerm) return true
                              const searchLower = studentSearchTerm.toLowerCase()
                              const fullName = `${student.first_name} ${student.last_name || ''}`.toLowerCase()
                              const admissionNumber = (student.admission_number || '').toLowerCase()
                              return fullName.includes(searchLower) || admissionNumber.includes(searchLower)
                            }).length === 0 && (
                              <div className="px-4 py-2 text-sm text-gray-500">No students found</div>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedStudent && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Selected: {selectedStudent.first_name} {selectedStudent.last_name || ''} ({selectedStudent.admission_number})
                        </p>
                      )}
                      {!selectedStudent && isParentRole && (
                        <p className="mt-1 text-xs text-amber-700">
                          Please select a student to link this parent account
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="label-text mb-2">Parent Type *</label>
                      <SelectField
                        value={formData.parent_type}
                        onChange={(e) => setFormData({ ...formData, parent_type: e.target.value })}
                        className="select-field"
                        required={isParentRole}
                      >
                        <option value="">Select Parent Type</option>
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                      </SelectField>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setFormData({
                        email: '',
                        password: '',
                        name: '',
                        phone: '',
                        role_id: '',
                        branch_id: '',
                        student_id: '',
                        parent_type: '',
                        license_number: '',
                        license_expiry: '',
                      })
                      setSelectedStudent(null)
                      setStudentSearchTerm('')
                      setShowStudentDropdown(false)
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {createUserMutation.isLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showPasswordModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="glass-card p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="page-title">Reset Password</h2>
                <button
                  onClick={() => {
                    setShowPasswordModal(false)
                    setSelectedUser(null)
                    setPasswordData(null)
                    setFormData({ ...formData, password: '' })
                  }}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {passwordData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-800 mb-2">Password reset successfully!</p>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-slate-500 mb-1">New Password:</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={passwordData.password}
                          readOnly
                          className="flex-1 px-3 py-2 border border-green-400/30 rounded bg-slate-50 text-slate-900 font-mono text-sm"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(passwordData.password)
                            alert('Password copied to clipboard!')
                          }}
                          className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-green-700"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Please share this password with the user securely.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowPasswordModal(false)
                      setSelectedUser(null)
                      setPasswordData(null)
                      setFormData({ ...formData, password: '' })
                    }}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-600 mb-4">
                    Reset password for <strong>{selectedUser.name}</strong> ({selectedUser.email})
                  </p>

                  <div>
                    <label className="label-text mb-2">New Password (or leave empty to generate)</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Leave empty to auto-generate"
                      className="input-field placeholder-slate-400"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false)
                        setSelectedUser(null)
                        setFormData({ ...formData, password: '' })
                      }}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(selectedUser.id, !formData.password)}
                      disabled={resetPasswordMutation.isLoading}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {resetPasswordMutation.isLoading
                        ? 'Resetting...'
                        : formData.password
                        ? 'Set Password'
                        : 'Generate Password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
