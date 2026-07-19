'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export default function ClassesPage() {
  const { user, token } = useAuth()
  const { academicYear, academicYears, setAcademicYear } = useAcademicYear()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(
    user?.role_name === 'Super Admin' ? null : (user?.school_id || null)
  )
  const [selectedClass, setSelectedClass] = useState<any>(null)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [editingSection, setEditingSection] = useState<any>(null)
  const [editingClass, setEditingClass] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    level: '',
    section: '',
    description: '',
  })
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<number | null>(null)

  const [sectionFormData, setSectionFormData] = useState({
    name: '',
    code: '',
    capacity: '40',
  })

  // Sync selectedAcademicYearId with academicYear context when it changes
  // Only use academic years that are actually in the academicYears array (belong to current school)
  useEffect(() => {
    if (academicYear?.id) {
      // Verify the academic year exists in the available academic years for this school
      const isValidYear = academicYears?.some((y: any) => y.id === academicYear.id)
      if (isValidYear) {
        setSelectedAcademicYearId(academicYear.id)
      } else {
        // If the stored academic year doesn't belong to this school, use the first available one
        if (academicYears && academicYears.length > 0) {
          const firstYear = academicYears[0]
          setSelectedAcademicYearId(firstYear.id)
          setAcademicYear(firstYear)
        } else {
          setSelectedAcademicYearId(null)
        }
      }
    } else if (academicYears && academicYears.length > 0 && !selectedAcademicYearId) {
      // If no academic year is selected but we have available years, select the first one
      const firstYear = academicYears[0]
      setSelectedAcademicYearId(firstYear.id)
    }
  }, [academicYear?.id, academicYears])

  // Fetch schools for Super Admin
  const { data: schools } = useQuery(
    ['schools'],
    async () => {
      const response = await axios.get(`${API_URL}/schools`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data
    },
    { enabled: !!user && user.role_name === 'Super Admin' }
  )

  // Determine which school_id to use
  const effectiveSchoolId = user?.role_name === 'Super Admin' ? selectedSchoolId : user?.school_id

  // Fetch sections for selected class
  const { data: sections, refetch: refetchSections } = useQuery(
    ['sections', selectedClass?.id, academicYear?.id],
    async () => {
      if (!selectedClass?.id) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          class_id: selectedClass.id,
          school_id: effectiveSchoolId,
          academic_year_id: academicYear?.id,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': academicYear?.id,
        },
      })
      return response.data.data || []
    },
    { enabled: !!selectedClass?.id && !!academicYear && !!effectiveSchoolId }
  )

  const { data: classes, refetch } = useQuery(
    ['classes', effectiveSchoolId, academicYear?.id],
    async () => {
      const response = await axios.get(`${API_URL}/classes`, {
        params: {
          school_id: effectiveSchoolId,
          academic_year_id: academicYear?.id,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          'academic-year-id': academicYear?.id,
        },
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && !!effectiveSchoolId }
  )

  const createMutation = useMutation(
    async (data: any) => {
      // Explicitly get academic_year_id from data (should be set in handleSubmit)
      const academicYearId = data.academic_year_id
      
      if (!academicYearId) {
        throw new Error('Academic year ID is required. Please select an academic year.')
      }

      // Ensure academic_year_id is a number, not the level value
      const finalAcademicYearId = Number(academicYearId)
      
      if (isNaN(finalAcademicYearId) || finalAcademicYearId <= 0) {
        throw new Error(`Invalid academic year ID: ${academicYearId}. Please select a valid academic year.`)
      }

      // Explicitly construct the payload to avoid any field conflicts
      // Note: 'section' is not a field in the classes table - sections are managed separately
      const payload = {
        name: data.name,
        code: data.code || null,
        level: data.level || null,
        description: data.description || null,
        school_id: effectiveSchoolId,
        academic_year_id: finalAcademicYearId,
      }

      console.log('Sending request with:', {
        academicYearId: finalAcademicYearId,
        schoolId: effectiveSchoolId,
        payload
      })

      const response = await axios.post(
        `${API_URL}/classes`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': finalAcademicYearId.toString(),
          },
        }
      )

      const classId = response.data.data?.id

      // If a section was selected, create a section for this class
      if (data.section && classId) {
        try {
          await axios.post(
            `${API_URL}/sections`,
            {
              name: data.section,
              code: data.section,
              class_id: classId,
              school_id: effectiveSchoolId,
              academic_year_id: finalAcademicYearId,
              capacity: 40,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'academic-year-id': finalAcademicYearId.toString(),
              },
            }
          )
          console.log('Section created successfully:', data.section)
        } catch (sectionError: any) {
          console.error('Failed to create section:', sectionError)
          // Don't fail the whole operation if section creation fails
          // Just log it - the class was created successfully
        }
      }

      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['classes', effectiveSchoolId, academicYear?.id])
        refetch()
        resetForm()
        alert('Class created successfully!')
      },
      onError: (error: any) => {
        console.error('Create class error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to create class'
        alert(errorMessage)
      },
    }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingClass) {
      // Update existing class
      updateClassMutation.mutate({
        id: editingClass.id,
        data: formData
      })
      return
    }

    // Create new class
    if (!selectedAcademicYearId) {
      alert('Please select an academic year from the dropdown before creating a class.')
      return
    }

    // Find the selected academic year object
    const selectedYear = academicYears?.find((y: any) => y.id === selectedAcademicYearId)
    
    if (!selectedYear) {
      alert(`Selected academic year (ID: ${selectedAcademicYearId}) not found in available academic years. Please select a valid academic year from the dropdown.`)
      console.error('Available academic years:', academicYears)
      console.error('Selected academic year ID:', selectedAcademicYearId)
      return
    }

    // Verify the academic year belongs to the school
    if (selectedYear.school_id !== effectiveSchoolId) {
      alert(`The selected academic year "${selectedYear.name}" does not belong to your school. Please select a valid academic year.`)
      return
    }

    // Update the context with the selected year
    if (selectedYear.id !== academicYear?.id) {
      setAcademicYear(selectedYear)
    }

    if (user?.role_name === 'Super Admin' && !selectedSchoolId) {
      alert('Please select a school.')
      return
    }

    if (!effectiveSchoolId) {
      alert('School ID is required. Please ensure you are assigned to a school.')
      return
    }

    console.log('Creating class with:', {
      formData,
      academicYearId: selectedAcademicYearId,
      academicYearName: selectedYear.name,
      academicYearSchoolId: selectedYear.school_id,
      schoolId: effectiveSchoolId
    })

    // Use the selected academic year ID - ensure it's a number
    // Explicitly exclude level from academic_year_id and ensure proper mapping
    const { level, ...restFormData } = formData
    createMutation.mutate({
      ...restFormData,
      level: level, // Keep level separate
      academic_year_id: Number(selectedAcademicYearId) // Explicitly set academic year ID
    })
  }

  const handleEditClass = (cls: any) => {
    setEditingClass(cls)
    setFormData({
      name: cls.name || '',
      code: cls.code || '',
      level: cls.level ? String(cls.level) : '',
      section: cls.section || '',
      description: cls.description || '',
    })
    setSelectedAcademicYearId(cls.academic_year_id || academicYear?.id || null)
    setShowForm(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      level: '',
      section: '',
      description: '',
    })
    setEditingClass(null)
    setSelectedAcademicYearId(academicYear?.id || null)
    setShowForm(false)
    if (user?.role_name === 'Super Admin') {
      setSelectedSchoolId(null)
    }
  }

  const handleViewDetails = (cls: any) => {
    setSelectedClass(cls)
    setShowSectionModal(true)
  }

  const closeSectionModal = () => {
    setShowSectionModal(false)
    setSelectedClass(null)
    setShowSectionForm(false)
    setEditingSection(null)
    resetSectionForm()
  }

  const resetSectionForm = () => {
    setSectionFormData({
      name: '',
      code: '',
      capacity: '40',
    })
    setShowSectionForm(false)
    setEditingSection(null)
  }

  const createSectionMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/sections`,
        {
          ...data,
          class_id: selectedClass.id,
          school_id: effectiveSchoolId,
          academic_year_id: academicYear?.id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear?.id,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sections', selectedClass?.id, academicYear?.id])
        queryClient.invalidateQueries(['classes', effectiveSchoolId, academicYear?.id])
        refetchSections()
        refetch()
        resetSectionForm()
        alert('Section created successfully!')
      },
      onError: (error: any) => {
        console.error('Create section error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to create section'
        alert(errorMessage)
      },
    }
  )

  const updateSectionMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${API_URL}/sections/${id}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear?.id,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sections', selectedClass?.id, academicYear?.id])
        queryClient.invalidateQueries(['classes', effectiveSchoolId, academicYear?.id])
        refetchSections()
        refetch()
        resetSectionForm()
        alert('Section updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update section error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to update section'
        alert(errorMessage)
      },
    }
  )

  const deleteSectionMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(
        `${API_URL}/sections/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear?.id,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['sections', selectedClass?.id, academicYear?.id])
        queryClient.invalidateQueries(['classes', effectiveSchoolId, academicYear?.id])
        refetchSections()
        refetch()
        alert('Section deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete section error:', error)
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete section'
        alert(errorMessage)
      },
    }
  )

  const updateClassMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${API_URL}/classes/${id}`,
        {
          name: data.name,
          code: data.code || null,
          level: data.level || null,
          description: data.description || null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear?.id,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['classes', effectiveSchoolId, academicYear?.id])
        refetch()
        resetForm()
        alert('Class updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update class error:', error)
        const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || error.message || 'Failed to update class'
        alert(errorMessage)
      },
    }
  )

  const deleteClassMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(
        `${API_URL}/classes/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'academic-year-id': academicYear?.id,
          },
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['classes', effectiveSchoolId, academicYear?.id])
        refetch()
        alert('Class deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete class error:', error)
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete class'
        alert(errorMessage)
      },
    }
  )

  const handleDeleteClass = (cls: any) => {
    if (confirm(`Are you sure you want to delete class "${cls.name}"? This action cannot be undone.${cls.section_count > 0 ? '\n\nNote: This class has sections. Please delete all sections first.' : ''}`)) {
      deleteClassMutation.mutate(cls.id)
    }
  }

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, data: sectionFormData })
    } else {
      createSectionMutation.mutate(sectionFormData)
    }
  }

  const handleSectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setSectionFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleEditSection = (section: any) => {
    setEditingSection(section)
    setSectionFormData({
      name: section.name || '',
      code: section.code || '',
      capacity: String(section.capacity || 40),
    })
    setShowSectionForm(true)
  }

  const handleDeleteSection = (section: any) => {
    if (confirm(`Are you sure you want to delete section "${section.name}"? This action cannot be undone.`)) {
      deleteSectionMutation.mutate(section.id)
    }
  }

  return (
    <Layout>
      <div className="page-container">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="page-title">Classes</h1>
            <p className="page-subtitle">Manage classes and sections</p>
          </div>
          <button
            onClick={() => {
              if (showForm) {
                resetForm()
              } else {
                setShowForm(true)
              }
            }}
            className="btn-primary self-start sm:self-auto"
          >
            {showForm ? 'Cancel' : 'New Class'}
          </button>
        </div>

        {showForm && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-4">{editingClass ? 'Edit Class' : 'Create New Class'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {user?.role_name === 'Super Admin' && (
                <div>
                  <label htmlFor="school_id" className="label-text">
                    School <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="school_id"
                    value={selectedSchoolId || ''}
                    onChange={(e) => setSelectedSchoolId(e.target.value ? Number(e.target.value) : null)}
                    required
                    className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400 appearance-none cursor-pointer hover:border-gray-400 transition-colors"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="" disabled hidden>Select a school</option>
                    {schools?.map((school: any) => (
                      <option key={school.id} value={school.id} className="bg-white text-gray-900">
                        {school.name} ({school.code})
                      </option>
                    ))}
                  </SelectField>
                </div>
              )}

              <div>
                <label htmlFor="academic_year_id" className="label-text">
                  Academic Year <span className="text-red-600">*</span>
                </label>
                <SelectField
                  id="academic_year_id"
                  name="academic_year_id"
                  value={selectedAcademicYearId || ''}
                  onChange={(e) => {
                    const yearId = e.target.value ? Number(e.target.value) : null
                    setSelectedAcademicYearId(yearId)
                    const selectedYear = academicYears?.find((y: any) => y.id === yearId)
                    if (selectedYear) {
                      setAcademicYear(selectedYear)
                    }
                  }}
                  required
                  disabled={!!editingClass}
                  className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400 appearance-none cursor-pointer hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="" disabled hidden>
                    {academicYears && academicYears.length > 0 
                      ? 'Select an academic year' 
                      : 'No academic years available. Please create one first.'}
                  </option>
                  {academicYears?.map((year: any) => (
                    <option key={year.id} value={year.id} className="bg-white text-gray-900">
                      {year.name} {year.is_active ? '(Active)' : ''}
                    </option>
                  ))}
                </SelectField>
                {(!academicYears || academicYears.length === 0) && (
                  <p className="mt-1 text-xs text-yellow-300 ">
                    No academic years found. Please go to <a href="/academic-years" className="underline">Academic Years</a> page to create one first.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="label-text">
                    Class Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g., Class 1, Grade 1"
                    className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="code" className="label-text">
                    Class Code
                  </label>
                  <input
                    type="text"
                    id="code"
                    name="code"
                    value={formData.code}
                    onChange={handleChange}
                    placeholder="e.g., C1, G1"
                    className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="level" className="label-text">
                    Level
                  </label>
                  <input
                    type="number"
                    id="level"
                    name="level"
                    value={formData.level}
                    onChange={handleChange}
                    placeholder="e.g., 1, 2, 3"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  />
                  <p className="mt-1 text-xs text-slate-500 ">Numeric level for sorting (1 = first grade, 2 = second grade, etc.)</p>
                </div>
                <div>
                  <label htmlFor="section" className="label-text">
                    Section
                  </label>
                  <SelectField
                    id="section"
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer hover:border-gray-400 transition-colors"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="">Select a section</option>
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((section) => (
                      <option key={section} value={section} className="bg-white text-gray-900">
                        {section}
                      </option>
                    ))}
                  </SelectField>
                  <p className="mt-1 text-xs text-slate-500 ">Section identifier (optional)</p>
                </div>
              </div>

              <div>
                <label htmlFor="description" className="label-text">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Optional description for this class"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading || updateClassMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-slate-900 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingClass
                    ? (updateClassMutation.isLoading ? 'Updating...' : 'Update Class')
                    : (createMutation.isLoading ? 'Creating...' : 'Create Class')}
                </button>
              </div>
            </form>
          </div>
        )}

        {!showForm && (
          <>
            {user?.role_name === 'Super Admin' && (
              <div className="bg-white rounded-lg shadow p-4 mb-6">
                <label htmlFor="view_school_id" className="label-text mb-2">
                  Select School to View Classes
                </label>
                <SelectField
                  id="view_school_id"
                  value={selectedSchoolId || ''}
                  onChange={(e) => setSelectedSchoolId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer hover:border-gray-400 transition-colors"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="">Select a school</option>
                  {schools?.map((school: any) => (
                    <option key={school.id} value={school.id} className="bg-white text-gray-900">
                      {school.name} ({school.code})
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            {user?.role_name === 'Super Admin' && !selectedSchoolId && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  Please select a school above to view classes.
                </p>
              </div>
            )}

            {(!classes || classes.length === 0) && effectiveSchoolId ? (
              <div className="text-center py-12 glass-card">
                <p className="text-slate-500 ">No classes found. Create a class to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classes?.map((cls: any) => (
                  <div key={cls.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-bold text-gray-900">{cls.name}</h3>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditClass(cls)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          title="Edit class"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteClass(cls)}
                          disabled={deleteClassMutation.isLoading}
                          className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete class"
                        >
                          {deleteClassMutation.isLoading ? 'Deleting...' : '🗑️'}
                        </button>
                      </div>
                    </div>
                    {cls.code && (
                      <p className="text-sm text-gray-600 mb-1">Code: {cls.code}</p>
                    )}
                    {cls.level && (
                      <p className="text-sm text-gray-500 mb-4">Level: {cls.level}</p>
                    )}
                    <div className="mt-4">
                      <span className="text-sm text-gray-600">{cls.section_count || 0} Sections</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Section Management Modal */}
        {showSectionModal && selectedClass && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Manage Sections: {selectedClass.name}
                  </h2>
                  {selectedClass.level && (
                    <p className="text-sm text-gray-500 mt-1">Level {selectedClass.level}</p>
                  )}
                </div>
                <button
                  onClick={closeSectionModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Add Section Button */}
                {!showSectionForm && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowSectionForm(true)}
                      className="px-4 py-2 bg-blue-600 text-slate-900 rounded-lg hover:bg-blue-700"
                    >
                      + Add Section
                    </button>
                  </div>
                )}

                {/* Section Form */}
                {showSectionForm && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {editingSection ? 'Edit Section' : 'Create New Section'}
                    </h3>
                    <form onSubmit={handleSectionSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="section_name" className="block text-sm font-medium text-gray-700 mb-1">
                            Section Name <span className="text-red-600">*</span>
                          </label>
                          <input
                            type="text"
                            id="section_name"
                            name="name"
                            value={sectionFormData.name}
                            onChange={handleSectionChange}
                            required
                            placeholder="e.g., A, B, C or Section 1"
                            className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                          />
                        </div>

                        <div>
                          <label htmlFor="section_code" className="block text-sm font-medium text-gray-700 mb-1">
                            Section Code
                          </label>
                          <input
                            type="text"
                            id="section_code"
                            name="code"
                            value={sectionFormData.code}
                            onChange={handleSectionChange}
                            placeholder="e.g., SEC-A"
                            className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                          />
                        </div>

                        <div>
                          <label htmlFor="section_capacity" className="block text-sm font-medium text-gray-700 mb-1">
                            Capacity
                          </label>
                          <input
                            type="number"
                            id="section_capacity"
                            name="capacity"
                            value={sectionFormData.capacity}
                            onChange={handleSectionChange}
                            min="1"
                            placeholder="40"
                            className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-3 pt-2">
                        <button
                          type="button"
                          onClick={resetSectionForm}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createSectionMutation.isLoading || updateSectionMutation.isLoading}
                          className="px-4 py-2 bg-blue-600 text-slate-900 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {editingSection
                            ? (updateSectionMutation.isLoading ? 'Updating...' : 'Update Section')
                            : (createSectionMutation.isLoading ? 'Creating...' : 'Create Section')
                          }
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Sections List */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Sections ({sections?.length || 0})
                  </h3>

                  {sections && sections.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Section Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Code
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Capacity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Current Strength
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sections.map((section: any) => (
                            <tr key={section.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {section.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {section.code || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {section.capacity || 40}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  section.current_strength >= (section.capacity || 40)
                                    ? 'bg-red-100 text-red-800'
                                    : section.current_strength >= ((section.capacity || 40) * 0.8)
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {section.current_strength || 0} / {section.capacity || 40}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                  <button
                                    onClick={() => handleEditSection(section)}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSection(section)}
                                    disabled={deleteSectionMutation.isLoading}
                                    className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {deleteSectionMutation.isLoading ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                      <p className="text-yellow-800 mb-2">
                        No sections found for this class.
                      </p>
                      <p className="text-yellow-700 text-sm">
                        Create sections to organize students. Sections created here will be available in the student admission form.
                      </p>
                    </div>
                  )}
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Sections created here will be automatically available in the student admission form when selecting this class.
                  </p>
                </div>

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t">
                  <button
                    onClick={closeSectionModal}
                    className="px-4 py-2 bg-gray-600 text-slate-900 rounded-lg hover:bg-gray-700"
                  >
                    Close
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
