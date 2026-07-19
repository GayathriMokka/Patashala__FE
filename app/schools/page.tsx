'use client'

import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState } from 'react'
import { getSchoolLogoUrl } from '@/lib/schoolBranding'
import SchoolFeaturesDrawer from '@/components/features/SchoolFeaturesDrawer'
import EmailOtpVerify from '@/components/EmailOtpVerify'
import { useOtpEnforced } from '@/lib/useOtpEnforced'
import AppModal from '@/components/AppModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function SchoolsPage() {
  const { user, token } = useAuth()
  const queryClient = useQueryClient()
  const otpEnforced = useOtpEnforced()
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingSchool, setEditingSchool] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    board_type: 'CBSE',
    school_type: '',
  })
  const [adminData, setAdminData] = useState({
    admin_name: '',
    admin_email: '',
    admin_password: '',
    admin_confirm_password: '',
    admin_phone: '',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [assignAdminSchool, setAssignAdminSchool] = useState<any>(null)
  const [featuresSchool, setFeaturesSchool] = useState<any>(null)
  const [adminEmailVerificationToken, setAdminEmailVerificationToken] = useState('')
  const [resetPasswordSchool, setResetPasswordSchool] = useState<any>(null)
  const [resetPasswordInput, setResetPasswordInput] = useState('')
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    admin_email: string
    admin_name: string
    password: string
  } | null>(null)

  const { data: schools, isLoading } = useQuery(
    ['schools'],
    async () => {
      const response = await axios.get(`${API_URL}/schools`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data
    },
    { enabled: !!user && !!token && user.role_name === 'Super Admin' }
  )

  const { data: pendingBranches, refetch: refetchPendingBranches } = useQuery(
    ['pending-branches'],
    async () => {
      const response = await axios.get(`${API_URL}/branches/pending/all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data || []
    },
    { enabled: !!user && !!token && user.role_name === 'Super Admin' }
  )

  const branchApprovalMutation = useMutation(
    async ({ id, action }: { id: number; action: 'approve' | 'reject' }) => {
      const response = await axios.post(
        `${API_URL}/branches/${id}/${action}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        refetchPendingBranches()
        queryClient.invalidateQueries(['branches'])
        alert(data?.message || 'Branch updated successfully')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to update branch')
      },
    }
  )

  const createMutation = useMutation(
    async (data: any) => {
      const formDataToSend = new FormData()
      
      // Append all form fields (exclude password confirmation)
      Object.keys(data).forEach(key => {
        if (key === 'admin_confirm_password') return
        if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
          formDataToSend.append(key, data[key])
        }
      })
      if (adminEmailVerificationToken) {
        formDataToSend.append('email_verification_token', adminEmailVerificationToken)
      }
      
      // Append logo file if selected
      if (logoFile) {
        formDataToSend.append('logo', logoFile)
      }
      
      const response = await axios.post(`${API_URL}/schools`, formDataToSend, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      })
      return response.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['schools'])
        setShowForm(false)
        setIsEditing(false)
        setEditingSchool(null)
        resetForm()
        const adminEmail = data?.data?.admin?.email
        alert(
          adminEmail
            ? `School created successfully!\n\nSchool Admin login:\nEmail: ${adminEmail}\n\nShare these credentials securely with the school administrator.`
            : 'School created successfully!'
        )
      },
    }
  )

  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const formDataToSend = new FormData()
      
      // Append all form fields (only non-empty values)
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
          formDataToSend.append(key, String(data[key]))
        }
      })
      
      // Append logo file if selected
      if (logoFile) {
        formDataToSend.append('logo', logoFile)
      }
      
      const response = await axios.put(`${API_URL}/schools/${id}`, formDataToSend, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['schools'])
        setShowForm(false)
        setIsEditing(false)
        setEditingSchool(null)
        resetForm()
        alert('School updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to update school'
        alert(errorMessage)
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      const url = `${API_URL}/schools/${id}`
      console.log('DELETE request to:', url)
      const response = await axios.delete(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['schools'])
      },
    }
  )

  const createAdminMutation = useMutation(
    async ({ schoolId, data }: { schoolId: number; data: typeof adminData }) => {
      const response = await axios.post(
        `${API_URL}/schools/${schoolId}/create-admin`,
        {
          admin_name: data.admin_name,
          admin_email: data.admin_email,
          admin_password: data.admin_password,
          admin_phone: data.admin_phone || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['schools'])
        setAssignAdminSchool(null)
        resetForm()
        const email = data?.data?.email
        alert(
          email
            ? `School Admin assigned!\n\nLogin email: ${email}\n\nShare the password securely with the administrator.`
            : 'School Admin assigned successfully!'
        )
      },
      onError: (error: any) => {
        const msg =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          'Failed to assign school admin'
        alert(msg)
      },
    }
  )

  const schoolActionMutation = useMutation(
    async ({ id, action }: { id: number; action: 'approve' | 'suspend' | 'renew-subscription' }) => {
      const response = await axios.post(`${API_URL}/schools/${id}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['schools'])
        alert(data.message || 'Action completed successfully')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Action failed')
      },
    }
  )

  const resetAdminPasswordMutation = useMutation(
    async ({
      schoolId,
      generate,
      newPassword,
    }: {
      schoolId: number
      generate: boolean
      newPassword?: string
    }) => {
      const response = await axios.post(
        `${API_URL}/schools/${schoolId}/reset-credentials`,
        {
          generate_password: generate,
          new_password: generate ? undefined : newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return response.data
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['schools'])
        setResetPasswordResult(data.data)
      },
      onError: (error: any) => {
        alert(
          error.response?.data?.error ||
            error.response?.data?.errors?.[0]?.msg ||
            'Failed to reset school admin password'
        )
      },
    }
  )

  const openResetPassword = (school: any) => {
    if (!school.admin_name || !school.admin_email) {
      alert('This school has no admin assigned. Use Assign Admin first.')
      return
    }
    setResetPasswordSchool(school)
    setResetPasswordInput('')
    setResetPasswordResult(null)
  }

  const closeResetPassword = () => {
    setResetPasswordSchool(null)
    setResetPasswordInput('')
    setResetPasswordResult(null)
  }

  const handleResetAdminPassword = (generate: boolean) => {
    if (!resetPasswordSchool) return
    if (!generate && resetPasswordInput.length < 8) {
      alert('Enter a password with at least 8 characters, or use Generate Password.')
      return
    }
    resetAdminPasswordMutation.mutate({
      schoolId: resetPasswordSchool.id,
      generate,
      newPassword: generate ? undefined : resetPasswordInput,
    })
  }

  const handleDelete = async (school: any) => {
    if (window.confirm(`Are you sure you want to delete "${school.name}"? This action cannot be undone and will delete all associated data (classes, students, teachers, etc.).`)) {
      try {
        await deleteMutation.mutateAsync(school.id)
        alert('School deleted successfully')
      } catch (error: any) {
        console.error('Delete error:', error)
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete school'
        if (error.response?.status === 404) {
          alert('Delete endpoint not found. Please ensure the backend server is running and has been restarted.')
        } else {
          alert(errorMessage)
        }
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
      pincode: '',
      board_type: 'CBSE',
      school_type: '',
    })
    setAdminData({
      admin_name: '',
      admin_email: '',
      admin_password: '',
      admin_confirm_password: '',
      admin_phone: '',
    })
    setLogoFile(null)
    setLogoPreview(null)
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB')
        return
      }
      
      setLogoFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleAdminChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name === 'admin_email') {
      setAdminEmailVerificationToken('')
    }
    setAdminData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isEditing && editingSchool) {
        await updateMutation.mutateAsync({ id: editingSchool.id, data: formData })
      } else {
        if (adminData.admin_password !== adminData.admin_confirm_password) {
          alert('Admin passwords do not match')
          return
        }
        if (adminData.admin_password.length < 8) {
          alert('Admin password must be at least 8 characters')
          return
        }
        if (otpEnforced && !adminEmailVerificationToken) {
          alert('Please verify the school admin email with OTP before creating the school.')
          return
        }
        await createMutation.mutateAsync({ ...formData, ...adminData })
      }
    } catch (error: any) {
      console.error('Submit error:', error)
      const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to save school'
      alert(errorMessage)
    }
  }

  const handleEdit = (school: any) => {
    setEditingSchool(school)
    setIsEditing(true)
    setShowForm(true)
    setFormData({
      name: school.name || '',
      code: school.code || '',
      email: school.email || '',
      phone: school.phone || '',
      address: school.address || '',
      city: school.city || '',
      state: school.state || '',
      country: school.country || 'India',
      pincode: school.pincode || '',
      board_type: school.board_type || 'CBSE',
      school_type: school.school_type || '',
    })
    // Set logo preview if logo exists
    if (school.logo_url) {
      const previewUrl = getSchoolLogoUrl(school.logo_url)
      setLogoPreview(previewUrl)
    } else {
      setLogoPreview(null)
    }
    setLogoFile(null)
  }

  const handleCancel = () => {
    setShowForm(false)
    setIsEditing(false)
    setEditingSchool(null)
    resetForm()
  }

  const openAssignAdmin = (school: any) => {
    setAssignAdminSchool(school)
    setAdminData({
      admin_name: '',
      admin_email: school.email || '',
      admin_password: '',
      admin_confirm_password: '',
      admin_phone: school.phone || '',
    })
  }

  const handleAssignAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignAdminSchool) return
    if (adminData.admin_password !== adminData.admin_confirm_password) {
      alert('Passwords do not match')
      return
    }
    if (adminData.admin_password.length < 8) {
      alert('Password must be at least 8 characters')
      return
    }
    await createAdminMutation.mutateAsync({
      schoolId: assignAdminSchool.id,
      data: adminData,
    })
  }

  if (!user || user.role_name !== 'Super Admin') {
    return (
      <Layout>
        <div className="alert-error px-4 py-3 rounded-lg shadow-lg">
          Access denied. Only Super Admin can manage schools.
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">Schools</h1>
            <p className="page-subtitle">Manage schools in the system</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              if (showForm) handleCancel()
            }}
            className="btn-primary self-start sm:self-auto"
          >
            {showForm ? 'Cancel' : 'Add School'}
          </button>
        </div>

        {showForm && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">
              {isEditing ? 'Edit School' : 'Create New School'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">
                    School Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    School Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400 uppercase"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div>
                  <label className="label-text">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label-text">
                    Address
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    Board Type
                  </label>
                  <SelectField
                    name="board_type"
                    value={formData.board_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400 appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.2em 1.2em',
                      paddingRight: '2rem'
                    }}
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                    <option value="IGCSE">IGCSE</option>
                    <option value="IB">IB</option>
                    <option value="Other">Other</option>
                  </SelectField>
                </div>

                <div>
                  <label className="label-text">
                    School Type <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    name="school_type"
                    value={formData.school_type}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400 appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.2em 1.2em',
                      paddingRight: '2rem'
                    }}
                  >
                    <option value="">Select School Type</option>
                    <option value="Preschool">Preschool</option>
                    <option value="Primary">Primary School (1-5)</option>
                    <option value="Secondary">Secondary School (6-10)</option>
                    <option value="Higher Secondary">Higher Secondary (11-12)</option>
                    <option value="Composite">Composite (All Classes)</option>
                  </SelectField>
                </div>

                <div className="md:col-span-2">
                  <label className="label-text">
                    School Logo
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400 text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1 ">Accepted formats: JPG, PNG, GIF, WEBP (Max 5MB)</p>
                    </div>
                    {logoPreview && (
                      <div className="flex-shrink-0">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-20 h-20 object-cover rounded-lg border border-gray-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!isEditing && (
                <div className="pt-6 mt-2 border-t border-white/20">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      School Administrator Account
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 ">
                      Create a dedicated login for this school. The admin will only access this school&apos;s data — fully isolated from other schools.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label-text">
                        Admin Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        name="admin_name"
                        value={adminData.admin_name}
                        onChange={handleAdminChange}
                        required
                        placeholder="e.g. Rajesh Kumar"
                        className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="label-text">
                        Admin Email (Login ID) <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="email"
                        name="admin_email"
                        value={adminData.admin_email}
                        onChange={handleAdminChange}
                        required
                        placeholder="admin@schoolname.edu"
                        className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                      />
                      {!isEditing && (
                        <EmailOtpVerify
                          email={adminData.admin_email}
                          purpose="registration"
                          onVerified={setAdminEmailVerificationToken}
                          onReset={() => setAdminEmailVerificationToken('')}
                        />
                      )}
                    </div>

                    <div>
                      <label className="label-text">
                        Admin Phone
                      </label>
                      <input
                        type="tel"
                        name="admin_phone"
                        value={adminData.admin_phone}
                        onChange={handleAdminChange}
                        placeholder="+91 9876543210"
                        className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                      />
                    </div>

                    <div />

                    <div>
                      <label className="label-text">
                        Admin Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        name="admin_password"
                        value={adminData.admin_password}
                        onChange={handleAdminChange}
                        required
                        minLength={8}
                        placeholder="Minimum 8 characters"
                        className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="label-text">
                        Confirm Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        name="admin_confirm_password"
                        value={adminData.admin_confirm_password}
                        onChange={handleAdminChange}
                        required
                        minLength={8}
                        placeholder="Re-enter password"
                        className="w-full px-3 py-2 input-field text-slate-900 placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  {createMutation.isLoading || updateMutation.isLoading
                    ? 'Saving...'
                    : isEditing
                    ? 'Update School'
                    : 'Create School'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 border border-slate-200 text-slate-900 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 transition-colors "
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {pendingBranches && pendingBranches.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-amber-50/80">
              <h2 className="text-lg font-semibold text-slate-900">Pending Branch Approvals</h2>
              <p className="text-sm text-slate-600 mt-1">
                School Admins have registered these branches. Approve to activate them.
              </p>
            </div>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">School</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingBranches.map((branch: any) => (
                  <tr key={branch.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-800">{branch.school_name}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{branch.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.code}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.city || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.phone || branch.email || '—'}</td>
                    <td className="px-6 py-4 text-right text-sm space-x-3">
                      <button
                        onClick={() => {
                          if (confirm(`Approve branch "${branch.name}" for ${branch.school_name}?`)) {
                            branchApprovalMutation.mutate({ id: branch.id, action: 'approve' })
                          }
                        }}
                        className="text-emerald-600 hover:text-emerald-800 font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Reject branch "${branch.name}"?`)) {
                            branchApprovalMutation.mutate({ id: branch.id, action: 'reject' })
                          }
                        }}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {isLoading ? (
          <div className="glass-card p-6 text-center">
            <p className="text-slate-500 ">Loading schools...</p>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    City
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    School Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Database
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Board Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schools && schools.length > 0 ? (
                  schools.map((school: any) => (
                    <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                        {school.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {school.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {school.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {school.city || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {school.admin_name ? (
                          <div>
                            <div className="font-medium text-white">{school.admin_name}</div>
                            <div className="text-xs text-slate-400">{school.admin_email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {school.db_name ? (
                          <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            {school.db_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Shared</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 ">
                        {school.board_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            school.is_active
                              ? 'badge-success'
                              : 'badge-danger'
                          }`}
                        >
                          {school.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-3 flex-wrap">
                          <button
                            onClick={() => handleEdit(school)}
                            className="text-primary-600 hover:text-primary-700 transition-colors "
                          >
                            Edit
                          </button>
                          {user?.role_name === 'Super Admin' && (
                            <button
                              onClick={() => setFeaturesSchool(school)}
                              className="text-violet-600 hover:text-violet-700 transition-colors"
                            >
                              Features
                            </button>
                          )}
                          {!school.admin_name && user?.role_name === 'Super Admin' && (
                            <button
                              onClick={() => openAssignAdmin(school)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              Assign Admin
                            </button>
                          )}
                          {user?.role_name === 'Super Admin' && (
                            <>
                              <button
                                onClick={() => schoolActionMutation.mutate({ id: school.id, action: school.is_active ? 'suspend' : 'approve' })}
                                className="text-amber-600 hover:text-amber-700 transition-colors "
                              >
                                {school.is_active ? 'Suspend' : 'Approve'}
                              </button>
                              <button
                                onClick={() => schoolActionMutation.mutate({ id: school.id, action: 'renew-subscription' })}
                                className="text-emerald-600 hover:text-emerald-700 transition-colors "
                              >
                                Renew
                              </button>
                              <button
                                onClick={() => openResetPassword(school)}
                                className="text-orange-600 hover:text-orange-700 transition-colors "
                              >
                                Reset Password
                              </button>
                            </>
                          )}
                          {user?.role_name === 'Super Admin' && (
                            <button
                              onClick={() => handleDelete(school)}
                              disabled={deleteMutation.isLoading}
                              className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors "
                            >
                              {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-sm text-slate-500 ">
                      No schools found. Create your first school to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {featuresSchool && token && (
          <SchoolFeaturesDrawer
            schoolId={featuresSchool.id}
            token={token}
            onClose={() => setFeaturesSchool(null)}
          />
        )}

        {assignAdminSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-2xl shadow-card border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900">Assign School Administrator</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Create login for <span className="font-semibold">{assignAdminSchool.name}</span>
                </p>
              </div>
              <form onSubmit={handleAssignAdminSubmit} className="p-6 space-y-4">
                <div>
                  <label className="label-text">Admin Full Name *</label>
                  <input
                    type="text"
                    name="admin_name"
                    value={adminData.admin_name}
                    onChange={handleAdminChange}
                    required
                    className="input-field"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="label-text">Admin Email (Login ID) *</label>
                  <input
                    type="email"
                    name="admin_email"
                    value={adminData.admin_email}
                    onChange={handleAdminChange}
                    required
                    className="input-field"
                    placeholder="admin@school.edu"
                  />
                </div>
                <div>
                  <label className="label-text">Phone</label>
                  <input
                    type="tel"
                    name="admin_phone"
                    value={adminData.admin_phone}
                    onChange={handleAdminChange}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Password *</label>
                  <input
                    type="password"
                    name="admin_password"
                    value={adminData.admin_password}
                    onChange={handleAdminChange}
                    required
                    minLength={8}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">Confirm Password *</label>
                  <input
                    type="password"
                    name="admin_confirm_password"
                    value={adminData.admin_confirm_password}
                    onChange={handleAdminChange}
                    required
                    minLength={8}
                    className="input-field"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={createAdminMutation.isLoading}
                    className="btn-primary flex-1"
                  >
                    {createAdminMutation.isLoading ? 'Creating...' : 'Create School Admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignAdminSchool(null)
                      resetForm()
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AppModal
          open={!!resetPasswordSchool}
          onClose={closeResetPassword}
          panelClassName="max-w-md"
          labelledBy="reset-school-admin-password-title"
        >
          <div className="app-modal-header">
            <div>
              <h2 id="reset-school-admin-password-title" className="modal-title">
                Reset School Admin Password
              </h2>
              {resetPasswordSchool ? (
                <p className="meta-text mt-1">
                  {resetPasswordSchool.name} — {resetPasswordSchool.admin_name} ({resetPasswordSchool.admin_email})
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={closeResetPassword}
              className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="app-modal-body">
            {resetPasswordResult ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <p className="text-sm text-emerald-200 mb-3">Password reset successfully. All active sessions were logged out.</p>
                  <label className="label-text">New password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      readOnly
                      value={resetPasswordResult.password}
                      className="input-field flex-1 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetPasswordResult.password)
                        alert('Password copied to clipboard')
                      }}
                      className="btn-secondary shrink-0 text-sm py-2"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-[11px] text-white/50 mt-2">
                    Share this password securely with {resetPasswordResult.admin_name}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-white/75">
                  Set a new password for the school admin, or generate a random one. Existing logins will be signed out.
                </p>
                <div>
                  <label htmlFor="reset_admin_password" className="label-text">
                    New password (optional)
                  </label>
                  <input
                    id="reset_admin_password"
                    type="password"
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    placeholder="Leave empty to auto-generate"
                    minLength={8}
                    className="input-field"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="app-modal-footer">
            {resetPasswordResult ? (
              <button type="button" onClick={closeResetPassword} className="btn-primary">
                Done
              </button>
            ) : (
              <>
                <button type="button" onClick={closeResetPassword} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleResetAdminPassword(true)}
                  disabled={resetAdminPasswordMutation.isLoading}
                  className="btn-secondary"
                >
                  {resetAdminPasswordMutation.isLoading ? 'Resetting…' : 'Generate Password'}
                </button>
                <button
                  type="button"
                  onClick={() => handleResetAdminPassword(false)}
                  disabled={resetAdminPasswordMutation.isLoading || resetPasswordInput.length < 8}
                  className="btn-primary disabled:opacity-50"
                >
                  {resetAdminPasswordMutation.isLoading ? 'Resetting…' : 'Set Password'}
                </button>
              </>
            )}
          </div>
        </AppModal>
      </div>
    </Layout>
  )
}
