'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useMemo, useEffect } from 'react'
import FeeCollectModal from '@/components/fees/FeeCollectModal'
import FeePaymentSuccess from '@/components/fees/FeePaymentSuccess'
import FeePaymentHistory from '@/components/fees/FeePaymentHistory'
import FeeInvoicePrint, { type InvoiceData } from '@/components/fees/FeeInvoicePrint'
import { invalidateFinanceQueries } from '@/lib/invalidateFinanceQueries'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { useUrlQueryState } from '@/lib/useUrlQueryState'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterBar,
  PageFilterClearButton,
  PageFilterField,
  PageFilterRow,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport, buildFallbackFilename } from '@/lib/usePageExport'
import { formatMoney } from '@/lib/formatMoney'

type FeesTab = 'structures' | 'history'

const getStudentNameFromFeeName = (feeName: string) => {
  const match = feeName.match(/^(.+?)\s*-\s*Fee/i)
  return match ? match[1].trim().toLowerCase() : feeName.toLowerCase()
}

const getStudentNameKey = (student: { first_name: string; last_name?: string }) =>
  `${student.first_name} ${student.last_name || ''}`.trim().toLowerCase()

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

function roundMoney(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100) / 100
}

export default function FeesPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { branch, isAllBranches, branchScopeKey, scopedHeaders } = useBranchYearScope()
  const { canAccess, accessLoading } = useRequirePageAccess('/fees')
  const isAllowed = canAccess

  const [activeTab, setActiveTab] = useUrlQueryState(
    'tab',
    ['structures', 'history'],
    'structures'
  ) as [FeesTab, (tab: FeesTab) => void]
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [filterSectionId, setFilterSectionId] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [collectFee, setCollectFee] = useState<any>(null)
  const [paymentSuccess, setPaymentSuccess] = useState<{
    paymentId: number
    receiptNumber: string
  } | null>(null)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceFetchToken, setInvoiceFetchToken] = useState(0)
  const [editingFee, setEditingFee] = useState<any>(null)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const isAccountant = user?.role_name === 'Accountant'
  const isSchoolAdmin = user?.role_name === 'School Admin'
  const canManageStructures = !isAccountant
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [formData, setFormData] = useState({
    name: '',
    class_id: '',
    description: '',
    total_amount: '',
    installments: [] as Array<{
      installment_number: number
      name: string
      amount: string
      due_date: string
      fine_amount: string
      fine_per_day: string
    }>,
  })

  // Fetch fee structures
  const { data: fees, refetch } = useQuery(
    ['fees', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/fees`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && isAllowed }
  )

  // Completed payments — used to compute paid/remaining when API omits those fields
  const { data: feePayments } = useQuery(
    ['fee-payments-summary', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/payments`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data as any[]
    },
    { enabled: !!user && !!academicYear && !!token && isAllowed }
  )

  const paidByFeeStructureId = useMemo(() => {
    const map = new Map<number, number>()
    ;(feePayments || []).forEach((payment) => {
      if (payment.status !== 'Completed') return
      const feeId = Number(payment.fee_structure_id)
      if (!feeId) return
      const amount = parseFloat(payment.amount ?? payment.total_amount ?? 0)
      map.set(feeId, roundMoney((map.get(feeId) || 0) + amount))
    })
    return map
  }, [feePayments])

  // Fetch classes for dropdown
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
    { enabled: !!user && !!academicYear && isAllowed }
  )

  // Fetch sections for list filters
  const { data: filterSections } = useQuery(
    ['sections', 'filter', filterClassId, academicYear?.id],
    async () => {
      if (!filterClassId) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          class_id: filterClassId,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && !!filterClassId && !showForm && isAllowed }
  )

  // Students for section matching on fee list (fee names map to students)
  const { data: allStudents } = useQuery(
    ['students', user?.school_id, academicYear?.id, branchScopeKey, 'fees-list'],
    async () => {
      const response = await axios.get(`${API_URL}/students`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && isAllowed }
  )

  const studentLookupById = useMemo(() => {
    const map = new Map<number, any>()
    allStudents?.forEach((student: any) => {
      map.set(Number(student.id), student)
    })
    return map
  }, [allStudents])

  const studentLookupByClassAndName = useMemo(() => {
    const map = new Map<string, any>()
    allStudents?.forEach((student: any) => {
      const key = `${student.class_id}:${getStudentNameKey(student)}`
      if (!map.has(key)) {
        map.set(key, student)
      }
    })
    return map
  }, [allStudents])

  const enrichedFees = useMemo(() => {
    return (fees || []).map((fee: any) => {
      const student = fee.student_id
        ? studentLookupById.get(Number(fee.student_id)) ?? null
        : studentLookupByClassAndName.get(
            `${fee.class_id}:${getStudentNameFromFeeName(fee.name)}`
          ) ?? null
      const total = roundMoney(parseFloat(fee.total_amount || 0))
      const paidFromApi =
        fee.paid_amount !== undefined && fee.paid_amount !== null
          ? roundMoney(parseFloat(fee.paid_amount))
          : null
      const paid =
        paidFromApi !== null && !Number.isNaN(paidFromApi)
          ? paidFromApi
          : paidByFeeStructureId.get(Number(fee.id)) || 0
      const remainingFromApi =
        fee.remaining_amount !== undefined && fee.remaining_amount !== null
          ? roundMoney(parseFloat(fee.remaining_amount))
          : null
      const remaining =
        remainingFromApi !== null && !Number.isNaN(remainingFromApi)
          ? remainingFromApi
          : roundMoney(Math.max(0, total - paid))

      return {
        ...fee,
        student_id: student?.id ?? null,
        student_name: student
          ? `${student.first_name} ${student.last_name || ''}`.trim()
          : getStudentNameFromFeeName(fee.name),
        section_name: student?.section_name || '—',
        section_id: student?.section_id ?? null,
        admission_number: student?.admission_number || '',
        roll_number: student?.roll_number || '',
        paid_amount: paid,
        remaining_amount: remaining,
      }
    })
  }, [fees, studentLookupById, studentLookupByClassAndName, paidByFeeStructureId])

  const filteredFees = useMemo(() => {
    return enrichedFees.filter((fee: any) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const matchesSearch =
          fee.name?.toLowerCase().includes(q) ||
          fee.student_name?.toLowerCase().includes(q) ||
          getStudentNameFromFeeName(fee.name).includes(q) ||
          fee.class_name?.toLowerCase().includes(q) ||
          fee.section_name?.toLowerCase().includes(q) ||
          fee.description?.toLowerCase().includes(q) ||
          fee.admission_number?.toLowerCase().includes(q) ||
          String(fee.roll_number ?? '').toLowerCase().includes(q) ||
          String(fee.total_amount ?? '').includes(q) ||
          String(fee.paid_amount ?? '').includes(q) ||
          String(fee.remaining_amount ?? '').includes(q)
        if (!matchesSearch) return false
      }

      if (filterClassId && fee.class_id !== Number(filterClassId)) {
        return false
      }

      if (filterSectionId && fee.section_id !== Number(filterSectionId)) {
        return false
      }

      return true
    })
  }, [enrichedFees, searchTerm, filterClassId, filterSectionId])

  const feeTotals = useMemo(() => {
    return filteredFees.reduce(
      (acc, fee: any) => ({
        total: roundMoney(acc.total + parseFloat(fee.total_amount || 0)),
        paid: roundMoney(acc.paid + parseFloat(fee.paid_amount ?? 0)),
        remaining: roundMoney(acc.remaining + parseFloat(fee.remaining_amount ?? 0)),
      }),
      { total: 0, paid: 0, remaining: 0 }
    )
  }, [filteredFees])

  const hasActiveFilters = !!(searchTerm || filterClassId || filterSectionId)

  const { isExporting, handleExport } = usePageExport({
    enabled: !!user?.school_id && !!academicYear?.id && !!token,
    headers: scopedHeaders,
    config: {
      mode: 'api',
      url: `${API_URL}/fees/export`,
      getParams: (format) => {
        const selectedClass = classes?.find((cls: any) => String(cls.id) === filterClassId)
        const selectedSection = filterSections?.find(
          (section: any) => String(section.id) === filterSectionId
        )
        return {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          format,
          class_id: filterClassId || undefined,
          section_id: filterSectionId || undefined,
          search: searchTerm.trim() || undefined,
          class_name: selectedClass?.name || undefined,
          section_name: selectedSection?.name || undefined,
        }
      },
      getFallbackFilename: (format) => {
        const selectedClass = classes?.find((cls: any) => String(cls.id) === filterClassId)
        const selectedSection = filterSections?.find(
          (section: any) => String(section.id) === filterSectionId
        )
        const parts = ['fee_structures']
        if (selectedClass?.name) {
          parts.push(
            String(selectedClass.name).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
          )
        }
        if (selectedSection?.name) {
          parts.push(
            `Sec_${String(selectedSection.name).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}`
          )
        }
        return buildFallbackFilename(parts.join('_'), format)
      },
    },
    onError: (message) => setExportError(message),
  })

  // Fetch sections for create/edit form
  const { data: sections, isLoading: sectionsLoading } = useQuery(
    ['sections', 'form', formData.class_id, academicYear?.id],
    async () => {
      if (!formData.class_id) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          class_id: formData.class_id,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && !!formData.class_id && isAllowed }
  )

  const sectionRequired = (sections?.length ?? 0) > 0
  const sectionsReady = !formData.class_id || !sectionsLoading
  const canSelectStudent =
    !!formData.class_id &&
    sectionsReady &&
    (!sectionRequired || !!selectedSectionId)

  // Fetch students filtered by class and section
  const { data: classStudents, isLoading: studentsLoading } = useQuery(
    ['students', user?.school_id, academicYear?.id, formData.class_id, selectedSectionId],
    async () => {
      if (!formData.class_id) return []
      const response = await axios.get(`${API_URL}/students`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          class_id: formData.class_id,
          section_id: selectedSectionId || undefined,
          status: 'Active',
        },
        headers: scopedHeaders,
      })
      return response.data.data
    },
    { enabled: !!user && !!academicYear && canSelectStudent && isAllowed }
  )

  // Students that already have a fee structure this academic year (by ID, with legacy name fallback)
  const studentsWithExistingFee = useMemo(() => {
    const studentIds = new Set<number>()
    const legacyClassNameKeys = new Set<string>()
    fees?.forEach((fee: any) => {
      if (fee.student_id) {
        studentIds.add(Number(fee.student_id))
      } else {
        legacyClassNameKeys.add(`${fee.class_id}:${getStudentNameFromFeeName(fee.name)}`)
      }
    })
    return { studentIds, legacyClassNameKeys }
  }, [fees])

  const availableStudentsForForm = useMemo(() => {
    if (!classStudents) return []
    if (editingFee) return classStudents

    return classStudents.filter((student: any) => {
      if (studentsWithExistingFee.studentIds.has(Number(student.id))) {
        return false
      }
      const legacyKey = `${formData.class_id}:${getStudentNameKey(student)}`
      return !studentsWithExistingFee.legacyClassNameKeys.has(legacyKey)
    })
  }, [classStudents, studentsWithExistingFee, editingFee, formData.class_id])

  useEffect(() => {
    if (!selectedStudentId || editingFee) return
    const stillAvailable = availableStudentsForForm.some(
      (s: any) => String(s.id) === selectedStudentId
    )
    if (!stillAvailable) {
      setSelectedStudentId('')
      setFormData((prev) => ({ ...prev, name: '' }))
    }
  }, [availableStudentsForForm, selectedStudentId, editingFee])

  // Create fee structure mutation
  const createMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/fees`,
        {
          ...data,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        { headers: scopedHeaders }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fees', user?.school_id, academicYear?.id])
        refetch()
        resetForm()
        alert('Fee structure created successfully!')
      },
      onError: (error: any) => {
        console.error('Create fee structure error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to create fee structure'
        alert(errorMessage)
      },
    }
  )

  // Update fee structure mutation
  const updateMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${API_URL}/fees/${id}`,
        {
          ...data,
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        { headers: scopedHeaders }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fees', user?.school_id, academicYear?.id])
        refetch()
        resetForm()
        alert('Fee structure updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update fee structure error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to update fee structure'
        alert(errorMessage)
      },
    }
  )

  // Delete fee structure mutation
  const deleteMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/fees/${id}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['fees', user?.school_id, academicYear?.id])
        refetch()
        alert('Fee structure deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete fee structure error:', error)
        const errorMessage =
          error.response?.data?.error || error.message || 'Failed to delete fee structure'
        alert(errorMessage)
      },
    }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingFee) {
      // Update existing fee structure
      if (!formData.name || !formData.class_id || !formData.total_amount) {
        alert('Please fill in all required fields')
        return
      }

      // Validate installments sum
      if (formData.installments.length > 0) {
        const totalInstallments = formData.installments.reduce(
          (sum, inst) => sum + parseFloat(inst.amount || '0'),
          0
        )
        const totalAmount = parseFloat(formData.total_amount)
        if (Math.abs(totalInstallments - totalAmount) > 0.01) {
          alert(
            `Installment amounts (${formatMoney(totalInstallments)}) do not match total amount (${formatMoney(totalAmount)})`
          )
          return
        }
      }

      const payload = {
        name: formData.name,
        class_id: parseInt(formData.class_id),
        description: formData.description || null,
        total_amount: parseFloat(formData.total_amount),
        installments: formData.installments.map((inst, index) => ({
          installment_number: inst.installment_number || index + 1,
          name: inst.name || `Installment ${index + 1}`,
          amount: parseFloat(inst.amount),
          due_date: inst.due_date || null,
          fine_amount: parseFloat(inst.fine_amount || '0'),
          fine_per_day: parseFloat(inst.fine_per_day || '0'),
        })),
      }

      updateMutation.mutate({ id: editingFee.id, data: payload })
      return
    }

    // Create new fee structure (student selection only required for new structures)
    if (!editingFee && !formData.class_id) {
      alert('Please select a class')
      return
    }
    if (!editingFee && sectionRequired && !selectedSectionId) {
      alert('Please select a section')
      return
    }
    if (!editingFee && !selectedStudentId) {
      alert('Please select a student')
      return
    }

    if (!formData.name || !formData.class_id || !formData.total_amount) {
      alert('Please fill in all required fields')
      return
    }

    // Validate installments sum
    if (formData.installments.length > 0) {
      const totalInstallments = formData.installments.reduce(
        (sum, inst) => sum + parseFloat(inst.amount || '0'),
        0
      )
      const totalAmount = parseFloat(formData.total_amount)
      if (Math.abs(totalInstallments - totalAmount) > 0.01) {
        alert(
          `Installment amounts (${formatMoney(totalInstallments)}) do not match total amount (${formatMoney(totalAmount)})`
        )
        return
      }
    }

    const payload = {
      name: formData.name,
      class_id: parseInt(formData.class_id),
      student_id: parseInt(selectedStudentId, 10),
      description: formData.description || null,
      total_amount: parseFloat(formData.total_amount),
      installments: formData.installments.map((inst, index) => ({
        installment_number: inst.installment_number || index + 1,
        name: inst.name || `Installment ${index + 1}`,
        amount: parseFloat(inst.amount),
        due_date: inst.due_date || null,
        fine_amount: parseFloat(inst.fine_amount || '0'),
        fine_per_day: parseFloat(inst.fine_per_day || '0'),
      })),
    }

    createMutation.mutate(payload)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    setFormData((prev) => ({
      ...prev,
      class_id: value,
      name: '',
    }))
    setSelectedSectionId('')
    setSelectedStudentId('')
  }

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSectionId(e.target.value)
    setSelectedStudentId('')
    setFormData((prev) => ({
      ...prev,
      name: '',
    }))
  }

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const studentId = e.target.value
    setSelectedStudentId(studentId)
    const selectedStudent = availableStudentsForForm.find((s: any) => s.id === parseInt(studentId))

    if (selectedStudent) {
      setFormData((prev) => ({
        ...prev,
        name: `${selectedStudent.first_name} ${selectedStudent.last_name || ''} - Fee ${academicYear?.name || ''}`.trim(),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        name: '',
      }))
    }
  }

  const addInstallment = () => {
    setFormData((prev) => ({
      ...prev,
      installments: [
        ...prev.installments,
        {
          installment_number: prev.installments.length + 1,
          name: '',
          amount: '',
          due_date: '',
          fine_amount: '0',
          fine_per_day: '0',
        },
      ],
    }))
  }

  const removeInstallment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      installments: prev.installments.filter((_, i) => i !== index).map((inst, i) => ({
        ...inst,
        installment_number: i + 1,
      })),
    }))
  }

  const updateInstallment = (index: number, field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      installments: prev.installments.map((inst, i) =>
        i === index ? { ...inst, [field]: value } : inst
      ),
    }))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      class_id: '',
      description: '',
      total_amount: '',
      installments: [],
    })
    setSelectedStudentId('')
    setSelectedSectionId('')
    setEditingFee(null)
    setShowForm(false)
  }

  // Format date for HTML date input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    
    try {
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString
      }
      
      // Parse the date and format it
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return ''
      }
      
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch (error) {
      console.error('Error formatting date:', error)
      return ''
    }
  }

  const handleEdit = async (fee: any) => {
    try {
      // Fetch full fee structure details including installments
      const response = await axios.get(`${API_URL}/fees/${fee.id}`, {
        headers: scopedHeaders,
      })

      const feeData = response.data.data

      if (feeData.student_id) {
        const linkedStudent = studentLookupById.get(Number(feeData.student_id))
        setSelectedStudentId(String(feeData.student_id))
        setSelectedSectionId(
          linkedStudent?.section_id ? String(linkedStudent.section_id) : ''
        )
      } else {
        const studentNameMatch = feeData.name.match(/^(.+?)\s*-\s*Fee/)
        if (studentNameMatch && feeData.class_id) {
          const studentName = studentNameMatch[1].trim()
          try {
            const studentsResponse = await axios.get(`${API_URL}/students`, {
              params: {
                school_id: user?.school_id,
                academic_year_id: academicYear?.id,
                class_id: feeData.class_id,
              },
              headers: scopedHeaders,
            })
            const classStudentList = studentsResponse.data.data || []
            const matchingStudent = classStudentList.find(
              (s: any) =>
                `${s.first_name} ${s.last_name || ''}`.trim() === studentName ||
                s.first_name === studentName
            )
            if (matchingStudent) {
              setSelectedStudentId(String(matchingStudent.id))
              setSelectedSectionId(
                matchingStudent.section_id ? String(matchingStudent.section_id) : ''
              )
            }
          } catch {
            // Student match is optional for edit
          }
        }
      }

      setFormData({
        name: feeData.name || '',
        class_id: String(feeData.class_id || ''),
        description: feeData.description || '',
        total_amount: String(feeData.total_amount || ''),
        installments:
          feeData.installments?.map((inst: any) => ({
            installment_number: inst.installment_number,
            name: inst.name || '',
            amount: String(inst.amount || ''),
            due_date: formatDateForInput(inst.due_date),
            fine_amount: String(inst.fine_amount || '0'),
            fine_per_day: String(inst.fine_per_day || '0'),
          })) || [],
      })

      setEditingFee(feeData)
      setShowForm(true)
    } catch (error: any) {
      console.error('Error fetching fee structure:', error)
      alert('Failed to load fee structure for editing')
    }
  }

  const handleDelete = (fee: any) => {
    if (
      confirm(
        `Are you sure you want to delete the fee structure "${fee.name}"?\n\nThis action cannot be undone.`
      )
    ) {
      deleteMutation.mutate(fee.id)
    }
  }

  const loadInvoice = async (paymentId: number) => {
    setInvoiceData(null)
    setInvoiceLoading(true)
    const fetchToken = Date.now()
    setInvoiceFetchToken(fetchToken)
    try {
      const response = await axios.get(`${API_URL}/payments/${paymentId}/invoice`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
          _t: fetchToken,
        },
        headers: {
          ...scopedHeaders,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })
      setInvoiceData(response.data.data)
    } catch {
      alert('Failed to load invoice. Please try again.')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handlePaymentSuccess = (paymentId: number, receiptNumber: string) => {
    setCollectFee(null)
    setPaymentSuccess({ paymentId, receiptNumber })
    invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
  }

  const handlePrintInvoice = async () => {
    if (!paymentSuccess) return
    await loadInvoice(paymentSuccess.paymentId)
    setPaymentSuccess(null)
  }

  const calculateRemainingAmount = () => {
    const total = parseFloat(formData.total_amount || '0')
    const allocated = formData.installments.reduce(
      (sum, inst) => sum + parseFloat(inst.amount || '0'),
      0
    )
    return total - allocated
  }

  if (accessLoading || !isAllowed) {
    return (
      <Layout>
        <div className="alert-error">
          <p className="text-sm text-red-800">
            {accessLoading
              ? 'Loading permissions...'
              : 'Access denied. Your role does not have Fees permission. Ask School Admin to grant it under Features.'}
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={showForm ? 'page-container' : 'fees-page-layout'}>
        <div className={showForm ? undefined : 'shrink-0 fees-page-toolbar'}>
          <div className="glass-card p-2 sm:p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('structures')
                    if (showForm) resetForm()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === 'structures'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Fee Structures
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history')
                    if (showForm) resetForm()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === 'history'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Payment History
                </button>
              </div>
              {canManageStructures && activeTab === 'structures' && (
                <button
                  onClick={() => {
                    if (isAllBranches) {
                      alert('Select a specific branch from the top bar before creating fee structures.')
                      return
                    }
                    if (showForm) {
                      resetForm()
                    } else {
                      setShowForm(true)
                    }
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 shadow-lg whitespace-nowrap shrink-0"
                >
                  {showForm ? 'Cancel' : 'New Fee Structure'}
                </button>
              )}
            </div>
          </div>
        </div>

        {collectFee && token && user?.school_id && academicYear && (
          <FeeCollectModal
            fee={collectFee}
            schoolId={user.school_id}
            academicYearId={academicYear.id}
            token={token}
            onClose={() => setCollectFee(null)}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {paymentSuccess && (
          <FeePaymentSuccess
            receiptNumber={paymentSuccess.receiptNumber}
            onPrint={handlePrintInvoice}
            onClose={() => setPaymentSuccess(null)}
          />
        )}

        {invoiceLoading && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg px-6 py-4 shadow-lg text-slate-700 text-sm">
              Loading latest invoice…
            </div>
          </div>
        )}

        {invoiceData && !invoiceLoading && (
          <FeeInvoicePrint
            key={`inv-${invoiceData.payment.id}-${invoiceFetchToken}-${invoiceData.payment.updated_at || ''}-${invoiceData.payment.payment_date}-${invoiceData.payment.amount}-${invoiceData.payment.total_amount}`}
            data={invoiceData}
            onClose={() => setInvoiceData(null)}
          />
        )}

        {activeTab === 'history' && token && user?.school_id && academicYear && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <FeePaymentHistory
              schoolId={user.school_id}
              academicYearId={academicYear.id}
              token={token}
              branchScopeKey={branchScopeKey}
              classes={classes}
              canManagePayments={isSchoolAdmin}
              onPrintInvoice={(id) => loadInvoice(id)}
              onPaymentsChanged={() => {
                invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
              }}
            />
          </div>
        )}

        {showForm && canManageStructures && activeTab === 'structures' && (
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold mb-4 text-slate-900">
              {editingFee ? 'Edit Fee Structure' : 'Create New Fee Structure'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-visible">
                <div className="relative z-30">
                  <label htmlFor="class_id" className="label-text">
                    Class <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="class_id"
                    name="class_id"
                    value={formData.class_id}
                    onChange={handleClassChange}
                    required
                    disabled={!!editingFee}
                    className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a class</option>
                    {classes?.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div className="relative z-20">
                  <label htmlFor="section_id" className="label-text">
                    Section {sectionRequired && !editingFee && <span className="text-red-600">*</span>}
                  </label>
                  <SelectField
                    id="section_id"
                    value={selectedSectionId}
                    onChange={handleSectionChange}
                    disabled={!!editingFee || !formData.class_id || sectionsLoading}
                    required={sectionRequired && !editingFee}
                    className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!formData.class_id
                        ? 'Select class first'
                        : sectionsLoading
                        ? 'Loading sections...'
                        : sectionRequired
                        ? 'Select a section'
                        : 'No sections (optional)'}
                    </option>
                    {sections?.map((sec: any) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div className="relative z-10">
                  <label htmlFor="student_id" className="label-text">
                    Student Name {!editingFee && <span className="text-red-600">*</span>}
                  </label>
                  <SelectField
                    id="student_id"
                    value={selectedStudentId}
                    onChange={handleStudentChange}
                    disabled={!!editingFee || !canSelectStudent || studentsLoading}
                    required={!editingFee}
                    className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {!formData.class_id
                        ? 'Select class first'
                        : sectionRequired && !selectedSectionId
                        ? 'Select section first'
                        : studentsLoading
                        ? 'Loading students...'
                        : 'Select a student'}
                    </option>
                    {availableStudentsForForm
                      .slice()
                      .sort((a: any, b: any) =>
                        `${a.first_name} ${a.last_name || ''}`.localeCompare(
                          `${b.first_name} ${b.last_name || ''}`
                        )
                      )
                      .map((student: any) => (
                        <option key={student.id} value={student.id}>
                          {student.first_name} {student.last_name || ''}
                          {student.admission_number ? ` (${student.admission_number})` : ''}
                        </option>
                      ))}
                  </SelectField>
                  {canSelectStudent && !studentsLoading && classStudents?.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">No active students found for this class and section.</p>
                  )}
                  {canSelectStudent &&
                    !studentsLoading &&
                    !editingFee &&
                    (classStudents?.length ?? 0) > 0 &&
                    availableStudentsForForm.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        All students in this section already have a fee structure for this academic year.
                      </p>
                    )}
                </div>
              </div>

              <div>
                <label htmlFor="name" className="label-text">
                  Fee Structure Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Auto-filled when student is selected"
                  className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="total_amount" className="label-text">
                    Total Amount (₹) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    id="total_amount"
                    name="total_amount"
                    value={formData.total_amount}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="label-text">
                    Remaining Amount
                  </label>
                  <div className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900">
                    {formatMoney(calculateRemainingAmount())}
                  </div>
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
                  placeholder="Optional description for this fee structure"
                  className="w-full px-4 py-2 input-field text-slate-900 placeholder-slate-400"
                />
              </div>

              {/* Installments Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-800">
                    Installments (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={addInstallment}
                    className="px-3 py-1 text-sm bg-green-600/80 text-slate-900 rounded hover:bg-green-700"
                  >
                    + Add Installment
                  </button>
                </div>

                {formData.installments.length > 0 && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {formData.installments.map((installment, index) => (
                      <div
                        key={index}
                        className="p-4 border border-slate-200 rounded-lg bg-slate-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="label-text">
                            Installment {installment.installment_number}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeInstallment(index)}
                            className="text-red-400 hover:text-red-600 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Name</label>
                            <input
                              type="text"
                              value={installment.name}
                              onChange={(e) => updateInstallment(index, 'name', e.target.value)}
                              placeholder={`Installment ${index + 1}`}
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Amount (₹)</label>
                            <input
                              type="number"
                              value={installment.amount}
                              onChange={(e) => updateInstallment(index, 'amount', e.target.value)}
                              min="0"
                              step="0.01"
                              required
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Due Date</label>
                            <input
                              type="date"
                              value={installment.due_date}
                              onChange={(e) => updateInstallment(index, 'due_date', e.target.value)}
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-900 border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Fine (₹)</label>
                            <input
                              type="number"
                              value={installment.fine_amount}
                              onChange={(e) => updateInstallment(index, 'fine_amount', e.target.value)}
                              min="0"
                              step="0.01"
                              placeholder="0"
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded bg-white text-slate-900 border-slate-300 placeholder-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {formData.installments.length === 0 && (
                  <p className="text-sm text-slate-500 italic">
                    No installments added. Fee can be paid as a single payment or add installments above.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {editingFee
                    ? updateMutation.isLoading
                      ? 'Updating...'
                      : 'Update Fee Structure'
                    : createMutation.isLoading
                    ? 'Creating...'
                    : 'Create Fee Structure'}
                </button>
              </div>
            </form>
          </div>
        )}

        {!showForm && activeTab === 'structures' && (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            <PageFilterBar className="fees-page-filters">
              <PageFilterRow className="gap-2 lg:gap-2.5">
                <PageFilterSearch
                  id="fee_search"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search by student, class, section, total, paid, or remaining..."
                />

                <PageFilterField id="filter_class" label="Class">
                  <SelectField
                    id="filter_class"
                    value={filterClassId}
                    onChange={(e) => {
                      setFilterClassId(e.target.value)
                      setFilterSectionId('')
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

                <PageFilterField id="filter_section" label="Section">
                  <SelectField
                    id="filter_section"
                    value={filterSectionId}
                    onChange={(e) => setFilterSectionId(e.target.value)}
                    disabled={!filterClassId}
                    className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {filterClassId ? 'All Sections' : 'Select class first'}
                    </option>
                    {filterSections?.map((section: any) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </SelectField>
                </PageFilterField>

                {hasActiveFilters ? (
                  <PageFilterClearButton
                    label="Clear filters"
                    onClick={() => {
                      setSearchTerm('')
                      setFilterClassId('')
                      setFilterSectionId('')
                    }}
                  />
                ) : null}

                <PageFilterActions>
                  <ExportMenu
                    onExport={(format) => {
                      setExportError(null)
                      return handleExport(format)
                    }}
                    isExporting={isExporting}
                    recordCount={filteredFees.length}
                  />
                </PageFilterActions>
              </PageFilterRow>

              {exportError ? (
                <p className="mt-2 text-sm text-red-200" role="alert">
                  {exportError}
                </p>
              ) : null}

              {hasActiveFilters ? (
                <p className="mt-1.5 text-xs text-white/60">
                  Showing {filteredFees.length} of {fees?.length ?? 0} fee structure
                  {(fees?.length ?? 0) === 1 ? '' : 's'}
                </p>
              ) : null}
            </PageFilterBar>

            <div className="flex-1 min-h-0 flex flex-col table-shell fees-page-table overflow-hidden">
              <div className="fees-table-scroll">
            <table className="data-table fees-table">
              <thead className="sticky">
                <tr>
                  <th className="fees-col-name">Name</th>
                  <th className="fees-col-class">Class</th>
                  <th className="fees-col-section">Section</th>
                  <th className="fees-col-amount">Total Amount</th>
                  <th className="fees-col-paid">Paid</th>
                  <th className="fees-col-remaining">Remaining</th>
                  <th className="fees-col-installments">Installments</th>
                  <th className="fees-col-status">Status</th>
                  <th className="fees-col-actions fees-col-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFees.map((fee: any) => {
                  const remaining = parseFloat(fee.remaining_amount ?? fee.total_amount ?? 0)
                  const fullyPaid = remaining <= 0.005
                  return (
                  <tr key={fee.id} className="hover:bg-white/5 transition-colors">
                    <td className="fees-col-name">
                      <span className="fees-cell-name" title={fee.name}>{fee.name}</span>
                    </td>
                    <td className="fees-col-class fees-cell-amount">
                      {fee.class_name}
                    </td>
                    <td className="fees-col-section fees-cell-amount">
                      {fee.section_name}
                    </td>
                    <td className="fees-col-amount fees-cell-amount">
                      {formatMoney(fee.total_amount)}
                    </td>
                    <td className="fees-col-paid fees-cell-amount text-emerald-300 font-medium">
                      {formatMoney(fee.paid_amount ?? 0)}
                    </td>
                    <td className="fees-col-remaining fees-cell-amount font-medium">
                      <span className={fullyPaid ? 'text-emerald-300' : 'text-amber-300'}>
                        {formatMoney(remaining)}
                      </span>
                    </td>
                    <td className="fees-col-installments fees-cell-amount">
                      {fee.installments?.length || 0}
                    </td>
                    <td className="fees-col-status">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          fee.is_active
                            ? 'badge-success'
                            : 'bg-gray-500/30 text-gray-100 border border-gray-400/30'
                        }`}
                      >
                        {fee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="fees-col-actions">
                      {isAccountant ? (
                        <button
                          type="button"
                          onClick={() => setCollectFee(fee)}
                          disabled={!fee.student_id || fullyPaid}
                          title={
                            !fee.student_id
                              ? 'Student not linked to this fee'
                              : fullyPaid
                              ? 'Fee fully paid'
                              : 'Collect fee payment'
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          Collect
                        </button>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={() => setCollectFee(fee)}
                            disabled={!fee.student_id || fullyPaid}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50"
                            title={
                              !fee.student_id
                                ? 'Student not linked'
                                : fullyPaid
                                ? 'Fee fully paid'
                                : 'Collect payment'
                            }
                          >
                            Collect
                          </button>
                          <button
                            onClick={() => handleEdit(fee)}
                            className="text-blue-600 hover:text-blue-700 transition-colors"
                            title="Edit fee structure"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(fee)}
                            disabled={deleteMutation.isLoading}
                            className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                            title="Delete fee structure"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
              {filteredFees.length > 0 ? (
                <tfoot>
                  <tr className="fees-table-totals-row">
                    <td colSpan={3} className="fees-col-name text-left font-semibold text-white/90">
                      <span className="fees-table-totals-label">
                        <span>Total</span>
                        <span className="fees-table-totals-count">
                          {filteredFees.length} {filteredFees.length === 1 ? 'record' : 'records'}
                        </span>
                      </span>
                    </td>
                    <td className="fees-col-amount fees-cell-amount font-semibold text-white">
                      {formatMoney(feeTotals.total)}
                    </td>
                    <td className="fees-col-paid fees-cell-amount font-semibold text-emerald-300">
                      {formatMoney(feeTotals.paid)}
                    </td>
                    <td className="fees-col-remaining fees-cell-amount font-semibold">
                      <span className={feeTotals.remaining <= 0.005 ? 'text-emerald-300' : 'text-amber-300'}>
                        {formatMoney(feeTotals.remaining)}
                      </span>
                    </td>
                    <td className="fees-col-installments" />
                    <td className="fees-col-status" />
                    <td className="fees-col-actions fees-col-actions-footer" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
            {fees && fees.length > 0 && filteredFees.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No fee structures match your search or filters.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    setFilterClassId('')
                    setFilterSectionId('')
                  }}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}
            {(!fees || fees.length === 0) && (
              <div className="text-center py-12 text-white/60">
                No fee structures found. Create a fee structure to get started.
              </div>
            )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
