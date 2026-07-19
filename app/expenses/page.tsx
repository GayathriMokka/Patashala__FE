'use client'

import SelectField from '@/components/SelectField'
import DdMmYyyyDateField from '@/components/DdMmYyyyDateField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import {
  getExpensePaymentModeOptions,
  normalizeExpensePaymentMode,
} from '@/lib/expensePaymentModes'
import { formatDateDDMMYYYY, parsePaymentDateForInput } from '@/lib/paymentDates'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useMemo, type ChangeEvent } from 'react'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterClearButton,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { invalidateFinanceQueries } from '@/lib/invalidateFinanceQueries'
import { formatMoney } from '@/lib/formatMoney'
import ExpensesSummary from '@/components/expenses/ExpensesSummary'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

function expenseStatusBadgeClass(status: string) {
  switch (status) {
    case 'Pending':
      return 'badge-warning'
    case 'Approved':
      return 'badge-info'
    case 'Rejected':
      return 'badge-danger'
    case 'Paid':
      return 'badge-success'
    default:
      return 'inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200'
  }
}

export default function ExpensesPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const {
    branch,
    isAllBranches,
    branchScopeKey,
    scopedHeaders,
    requireBranchForWrite,
    requireAcademicYearSelected,
  } = useBranchYearScope()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [existingBillUrl, setExistingBillUrl] = useState<string | null>(null)
  const [billMarkedForRemoval, setBillMarkedForRemoval] = useState(false)
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null)
  const [receiptMarkedForRemoval, setReceiptMarkedForRemoval] = useState(false)
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null)
  const [editReceiptPreview, setEditReceiptPreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    category: '',
    subcategory: '',
    amount: '',
    expense_date: parsePaymentDateForInput(null),
    vendor_name: '',
    description: '',
    payment_mode: 'Cash',
    transaction_id: '',
    bill_number: '',
    bill_url: '',
    payment_remarks: '',
  })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null)
  const [paymentData, setPaymentData] = useState({
    payment_mode: 'Cash',
    transaction_id: '',
    payment_remarks: '',
  })
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null)
  const [paymentReceiptPreview, setPaymentReceiptPreview] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const schoolId = user?.school_id
  const uploadsBaseUrl = API_URL.replace('/api', '')

  const defaultFormData = () => ({
    category: '',
    subcategory: '',
    amount: '',
    expense_date: parsePaymentDateForInput(null),
    vendor_name: '',
    description: '',
    payment_mode: 'Cash',
    transaction_id: '',
    bill_number: '',
    bill_url: '',
    payment_remarks: '',
  })

  const resetExpenseForm = () => {
    setShowForm(false)
    setEditingExpense(null)
    const freshFormData = defaultFormData()
    setFormData(freshFormData)
    setInvoiceFile(null)
    setInvoicePreview(null)
    setExistingBillUrl(null)
    setBillMarkedForRemoval(false)
    setExistingReceiptUrl(null)
    setReceiptMarkedForRemoval(false)
    setEditReceiptFile(null)
    setEditReceiptPreview(null)
    const invoiceInput = document.getElementById('invoice-input') as HTMLInputElement
    if (invoiceInput) invoiceInput.value = ''
    const editReceiptInput = document.getElementById('edit-receipt-input') as HTMLInputElement
    if (editReceiptInput) editReceiptInput.value = ''
  }

  const openCreateExpenseForm = () => {
    setEditingExpense(null)
    const freshFormData = defaultFormData()
    setFormData(freshFormData)
    setInvoiceFile(null)
    setInvoicePreview(null)
    setExistingBillUrl(null)
    setBillMarkedForRemoval(false)
    setExistingReceiptUrl(null)
    setReceiptMarkedForRemoval(false)
    setEditReceiptFile(null)
    setEditReceiptPreview(null)
    setShowForm(true)
  }

  const { data: expenseCategories } = useQuery(
    ['expense-categories', schoolId, 'active'],
    async () => {
      const response = await axios.get(`${API_URL}/expense-master/categories`, {
        params: { school_id: schoolId, active_only: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      })
      return response.data.data as { id: number; name: string }[]
    },
    { enabled: !!token && !!schoolId }
  )

  // Fetch expenses
  const { data: expenses, isLoading } = useQuery(
    ['expenses', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const params: Record<string, string | number> = {
        school_id: user?.school_id as number,
        academic_year_id: academicYear?.id as number,
      }

      const response = await axios.get(`${API_URL}/expenses`, {
        params,
        headers: scopedHeaders,
      })
      return response.data.data
    },
    {
      enabled: !!user && !!academicYear && !!token,
      staleTime: 0,
      keepPreviousData: false,
    }
  )

  // Create expense mutation
  const createExpenseMutation = useMutation(
    async (data: { formData: any; file: File | null }) => {
      const formDataToSend = new FormData()
      
      // Append all form fields
      Object.keys(data.formData).forEach((key) => {
        if (data.formData[key] !== null && data.formData[key] !== undefined && data.formData[key] !== '') {
          formDataToSend.append(key, data.formData[key])
        }
      })
      
      // Append file if exists
      if (data.file) {
        formDataToSend.append('invoice', data.file)
      }
      
      // Add school and academic year
      formDataToSend.append('school_id', user?.school_id?.toString() || '')
      formDataToSend.append('academic_year_id', academicYear?.id?.toString() || '')
      if (branch?.id) {
        formDataToSend.append('branch_id', String(branch.id))
      }

      const response = await axios.post(
        `${API_URL}/expenses`,
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
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        resetExpenseForm()
        alert('Expense request submitted successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to submit expense request')
      },
    }
  )

  const updateExpenseMutation = useMutation(
    async ({
      expenseId,
      formData: data,
      file,
      receiptFile,
      removeInvoice,
      removeReceipt,
    }: {
      expenseId: number
      formData: any
      file: File | null
      receiptFile: File | null
      removeInvoice: boolean
      removeReceipt: boolean
    }) => {
      const formDataToSend = new FormData()
      Object.keys(data).forEach((key) => {
        if (data[key] !== null && data[key] !== undefined && data[key] !== '') {
          formDataToSend.append(key, data[key])
        }
      })
      if (file) formDataToSend.append('invoice', file)
      if (receiptFile) formDataToSend.append('receipt', receiptFile)
      if (removeInvoice) formDataToSend.append('remove_invoice', 'true')
      if (removeReceipt) formDataToSend.append('remove_receipt', 'true')

      const response = await axios.put(`${API_URL}/expenses/${expenseId}`, formDataToSend, {
        headers: {
          ...scopedHeaders,
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        resetExpenseForm()
        alert('Expense updated successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to update expense')
      },
    }
  )

  const deleteExpenseMutation = useMutation(
    async (expenseId: number) => {
      const response = await axios.delete(`${API_URL}/expenses/${expenseId}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        alert('Expense deleted successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to delete expense')
      },
    }
  )

  // Approve expense mutation
  const approveExpenseMutation = useMutation(
    async (expenseId: number) => {
      const response = await axios.put(
        `${API_URL}/expenses/${expenseId}/approve`,
        {},
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        alert('Expense approved successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to approve expense')
      },
    }
  )

  // Reject expense mutation
  const rejectExpenseMutation = useMutation(
    async ({ expenseId, reason }: { expenseId: number; reason: string }) => {
      const response = await axios.put(
        `${API_URL}/expenses/${expenseId}/reject`,
        { rejection_reason: reason },
        {
          headers: scopedHeaders,
        }
      )
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        setShowRejectModal(false)
        setRejectionReason('')
        setSelectedExpense(null)
        alert('Expense rejected successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to reject expense')
      },
    }
  )

  const resetPaymentReceipt = () => {
    setPaymentReceiptFile(null)
    setPaymentReceiptPreview(null)
    const input = document.getElementById('payment-receipt-input') as HTMLInputElement
    if (input) input.value = ''
  }

  const closePayModal = () => {
    setShowPayModal(false)
    setSelectedExpense(null)
    setPaymentData({
      payment_mode: 'Cash',
      transaction_id: '',
      payment_remarks: '',
    })
    resetPaymentReceipt()
  }

  const handlePaymentReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload an image, PDF, or document.')
      return
    }

    setPaymentReceiptFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setPaymentReceiptPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setPaymentReceiptPreview(null)
    }
  }

  // Pay expense mutation
  const payExpenseMutation = useMutation(
    async ({
      expenseId,
      data,
      receiptFile,
    }: {
      expenseId: number
      data: any
      receiptFile: File | null
    }) => {
      const formDataToSend = new FormData()
      formDataToSend.append('payment_mode', data.payment_mode)
      if (data.transaction_id) formDataToSend.append('transaction_id', data.transaction_id)
      if (data.payment_remarks) formDataToSend.append('payment_remarks', data.payment_remarks)
      if (receiptFile) formDataToSend.append('receipt', receiptFile)

      const response = await axios.put(`${API_URL}/expenses/${expenseId}/pay`, formDataToSend, {
        headers: {
          ...scopedHeaders,
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['expenses'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        closePayModal()
        alert('Expense marked as paid successfully!')
      },
      onError: (error: any) => {
        alert(error.response?.data?.error || 'Failed to mark expense as paid')
      },
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.expense_date) {
      alert('Please enter a valid expense date in DD/MM/YYYY format')
      return
    }
    const submitFormData = { ...formData }
    if (!submitFormData.category || !submitFormData.amount) {
      alert('Please fill in all required fields')
      return
    }

    if (editingExpense) {
      updateExpenseMutation.mutate({
        expenseId: editingExpense.id,
        formData: submitFormData,
        file: invoiceFile,
        receiptFile: editReceiptFile,
        removeInvoice: billMarkedForRemoval && !invoiceFile,
        removeReceipt: receiptMarkedForRemoval && !editReceiptFile,
      })
      return
    }

    createExpenseMutation.mutate({ formData: submitFormData, file: invoiceFile })
  }

  const handleEdit = (expense: any) => {
    setEditingExpense(expense)
    const expenseDate = parsePaymentDateForInput(expense.expense_date)
    setFormData({
      category: expense.category || '',
      subcategory: expense.subcategory || '',
      amount: String(expense.amount ?? ''),
      expense_date: expenseDate,
      vendor_name: expense.vendor_name || '',
      description: expense.description || '',
      payment_mode: normalizeExpensePaymentMode(expense.payment_mode),
      transaction_id: expense.transaction_id || '',
      bill_number: expense.bill_number || '',
      bill_url: expense.bill_url || '',
      payment_remarks: expense.payment_remarks || '',
    })
    setExistingBillUrl(expense.bill_url || null)
    setBillMarkedForRemoval(false)
    setExistingReceiptUrl(expense.payment_receipt_url || null)
    setReceiptMarkedForRemoval(false)
    setInvoiceFile(null)
    setInvoicePreview(null)
    setEditReceiptFile(null)
    setEditReceiptPreview(null)
    setShowForm(true)
  }

  const handleDelete = (expense: any) => {
    const label = `${expense.category} — ${formatMoney(expense.amount)}`
    if (
      confirm(
        `Are you sure you want to delete this expense?\n\n${label}\n\nThis action cannot be undone.`
      )
    ) {
      deleteExpenseMutation.mutate(expense.id)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      
      // Validate file type
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload an image, PDF, or document.')
        return
      }

      setInvoiceFile(file)
      setBillMarkedForRemoval(false)

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setInvoicePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setInvoicePreview(null)
      }
    }
  }

  const removeInvoice = () => {
    setInvoiceFile(null)
    setInvoicePreview(null)
    const fileInput = document.getElementById('invoice-input') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  const removeExistingBill = () => {
    setBillMarkedForRemoval(true)
    removeInvoice()
  }

  const handleEditReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload an image, PDF, or document.')
      return
    }

    setEditReceiptFile(file)
    setReceiptMarkedForRemoval(false)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setEditReceiptPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setEditReceiptPreview(null)
    }
  }

  const resetEditReceipt = () => {
    setEditReceiptFile(null)
    setEditReceiptPreview(null)
    const input = document.getElementById('edit-receipt-input') as HTMLInputElement
    if (input) input.value = ''
  }

  const removeExistingReceipt = () => {
    setReceiptMarkedForRemoval(true)
    resetEditReceipt()
  }

  const canApprove = ['Super Admin', 'School Admin', 'Principal'].includes(user?.role_name || '')
  const canPay = ['Super Admin', 'School Admin', 'Accountant'].includes(user?.role_name || '')
  const canManageExpenses = ['Super Admin', 'School Admin'].includes(user?.role_name || '')
  const isTeacher = user?.role_name === 'Teacher'

  const allExpenses = expenses || []

  const statusCounts = useMemo(
    () => ({
      pending: allExpenses.filter((e: any) => e.status === 'Pending').length,
      approved: allExpenses.filter((e: any) => e.status === 'Approved').length,
      paid: allExpenses.filter((e: any) => e.status === 'Paid').length,
      total: allExpenses.length,
    }),
    [allExpenses]
  )

  const isSummaryView = statusFilter === 'summary'

  const searchFilteredExpenses = useMemo(() => {
    return allExpenses.filter((expense: any) => {
      if (categoryFilter && expense.category !== categoryFilter) {
        return false
      }
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase()
      return (
        expense.category?.toLowerCase().includes(q) ||
        expense.subcategory?.toLowerCase().includes(q) ||
        expense.vendor_name?.toLowerCase().includes(q) ||
        expense.requested_by_name?.toLowerCase().includes(q) ||
        expense.description?.toLowerCase().includes(q) ||
        expense.status?.toLowerCase().includes(q) ||
        String(expense.amount ?? '').includes(q)
      )
    })
  }, [allExpenses, searchTerm, categoryFilter])

  const displayExpenses = useMemo(() => {
    if (isSummaryView) return searchFilteredExpenses
    return searchFilteredExpenses.filter((expense: any) => {
      if (statusFilter && expense.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [searchFilteredExpenses, statusFilter, isSummaryView])

  const expenseTotalAmount = useMemo(
    () =>
      displayExpenses.reduce((sum, expense: any) => sum + parseFloat(expense.amount || 0), 0),
    [displayExpenses]
  )

  const hasActiveFilters = !!(searchTerm || categoryFilter)

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Expenses',
      filename: 'expenses',
      getSubtitle: () => {
        const parts: string[] = []
        if (statusFilter) parts.push(`Status: ${statusFilter}`)
        if (categoryFilter) parts.push(`Category: ${categoryFilter}`)
        if (searchTerm.trim()) parts.push(`Search: ${searchTerm.trim()}`)
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'expense_date', label: 'Date' },
        { key: 'category', label: 'Category' },
        { key: 'subcategory', label: 'Subcategory' },
        { key: 'vendor_name', label: 'Vendor' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
        { key: 'requested_by_name', label: 'Requested By' },
        { key: 'description', label: 'Description' },
      ],
      getRows: () =>
        displayExpenses.map((e: any) => ({
          expense_date: e.expense_date ? formatDateDDMMYYYY(e.expense_date) : '',
          category: e.category || '',
          subcategory: e.subcategory || '',
          vendor_name: e.vendor_name || '',
          amount: e.amount ?? '',
          status: e.status || '',
          requested_by_name: e.requested_by_name || '',
          description: e.description || '',
        })),
    },
  })

  const expenseTabClass = (active: boolean) =>
    `inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
      active
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`

  const emptyExpensesMessage = useMemo(() => {
    if (hasActiveFilters) return 'No expenses match your search or filters.'
    switch (statusFilter) {
      case 'Pending':
        return 'No pending expenses.'
      case 'Approved':
        return canPay ? 'No approved expenses awaiting payment.' : 'No approved expenses.'
      case 'Paid':
        return 'No paid expenses yet.'
      default:
        return isTeacher
          ? 'No expenses found. Apply for an expense to get started.'
          : 'No expenses found. Add an expense to get started.'
    }
  }, [hasActiveFilters, statusFilter, canPay, isTeacher])

  const expenseCountBadgeClass = (active: boolean, tone: 'amber' | 'blue' | 'emerald' | 'neutral') => {
    if (active) return 'bg-white/20 text-white'
    switch (tone) {
      case 'amber':
        return 'bg-amber-500/20 text-amber-300'
      case 'blue':
        return 'bg-blue-500/20 text-blue-300'
      case 'emerald':
        return 'bg-emerald-500/20 text-emerald-300'
      default:
        return 'bg-white/10 text-white/80'
    }
  }

  return (
    <Layout>
      <div className="fees-page-layout expenses-page-layout">
        <div className="shrink-0 fees-page-toolbar">
          <div className="glass-card p-2 sm:px-3 expenses-toolbar expenses-unified-toolbar">
            <div className="expenses-unified-toolbar-row">
              <div className="expenses-status-tabs" role="tablist" aria-label="Expense status">
                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === ''}
                  onClick={() => setStatusFilter('')}
                  className={expenseTabClass(statusFilter === '')}
                >
                  {isTeacher ? 'My Expenses' : 'Expenses'}
                  <span
                    className={`px-1 py-px rounded-full text-[10px] font-bold leading-tight ${expenseCountBadgeClass(statusFilter === '', 'neutral')}`}
                  >
                    {statusCounts.total}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'Pending'}
                  onClick={() => setStatusFilter('Pending')}
                  className={expenseTabClass(statusFilter === 'Pending')}
                >
                  Pending
                  <span
                    className={`px-1 py-px rounded-full text-[10px] font-bold leading-tight ${expenseCountBadgeClass(statusFilter === 'Pending', 'amber')}`}
                  >
                    {statusCounts.pending}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'Approved'}
                  onClick={() => setStatusFilter('Approved')}
                  className={expenseTabClass(statusFilter === 'Approved')}
                >
                  Approved
                  <span
                    className={`px-1 py-px rounded-full text-[10px] font-bold leading-tight ${expenseCountBadgeClass(statusFilter === 'Approved', 'blue')}`}
                  >
                    {statusCounts.approved}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'Paid'}
                  onClick={() => setStatusFilter('Paid')}
                  className={expenseTabClass(statusFilter === 'Paid')}
                >
                  Paid
                  <span
                    className={`px-1 py-px rounded-full text-[10px] font-bold leading-tight ${expenseCountBadgeClass(statusFilter === 'Paid', 'emerald')}`}
                  >
                    {statusCounts.paid}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={isSummaryView}
                  onClick={() => setStatusFilter('summary')}
                  className={expenseTabClass(isSummaryView)}
                >
                  <svg className="w-3 h-3 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Summary
                </button>

                {canApprove && statusCounts.pending > 0 && statusFilter !== 'Pending' && !isSummaryView && (
                  <span
                    className="expenses-pending-alert"
                    title={`${statusCounts.pending} awaiting approval`}
                  >
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="hidden xl:inline">{statusCounts.pending} awaiting</span>
                  </span>
                )}
              </div>

              <div className="expenses-toolbar-divider" aria-hidden />

              <PageFilterSearch
                id="expense_search"
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search category, vendor, amount, requester…"
                hideLabel
                className="expenses-toolbar-search"
              />

              <PageFilterField
                id="filter_category"
                label="Category"
                width="narrow"
                hideLabel
                className="expenses-toolbar-category"
              >
                <SelectField
                  id="filter_category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="select-field"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {expenseCategories?.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </SelectField>
              </PageFilterField>

              {hasActiveFilters ? (
                <PageFilterClearButton
                  label="Clear"
                  className="expenses-toolbar-clear"
                  onClick={() => {
                    setSearchTerm('')
                    setCategoryFilter('')
                  }}
                />
              ) : null}

              <PageFilterActions className="expenses-toolbar-actions">
                <ExportMenu
                  onExport={handleExport}
                  isExporting={isExporting}
                  recordCount={displayExpenses.length}
                  size="sm"
                />
              </PageFilterActions>

              {(isTeacher || canPay) && (
                <button
                  type="button"
                  onClick={openCreateExpenseForm}
                  className="expenses-toolbar-add"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">{isTeacher ? 'Apply' : 'Add Expense'}</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>

            {exportError ? (
              <p className="mt-1.5 text-xs text-red-200" role="alert">
                {exportError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {isSummaryView ? (
            <ExpensesSummary expenses={searchFilteredExpenses} isLoading={isLoading} />
          ) : (
          <div className="flex-1 min-h-0 flex flex-col table-shell fees-page-table expenses-page-table overflow-hidden">
            <div className="fees-table-scroll">
              <table className="data-table fees-table expenses-table">
                <colgroup>
                  <col className="expenses-col-date" />
                  <col className="expenses-col-category" />
                  <col className="expenses-col-amount" />
                  <col className="expenses-col-vendor" />
                  <col className="expenses-col-requested" />
                  <col className="expenses-col-invoice" />
                  <col className="expenses-col-status" />
                  {!isTeacher ? <col className="expenses-col-actions" /> : null}
                </colgroup>
                <thead className="sticky">
                  <tr>
                    <th className="expenses-col-date">Date</th>
                    <th className="expenses-col-category">Category</th>
                    <th className="expenses-col-amount text-right">Amount</th>
                    <th className="expenses-col-vendor">Vendor</th>
                    <th className="expenses-col-requested">Requested By</th>
                    <th className="expenses-col-invoice">Invoice</th>
                    <th className="expenses-col-status">Status</th>
                    {!isTeacher && (
                      <th className="fees-col-actions fees-col-actions-header expenses-col-actions">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={isTeacher ? 7 : 8} className="text-center py-8 text-white/60">
                        Loading expenses...
                      </td>
                    </tr>
                  ) : displayExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={isTeacher ? 7 : 8} className="text-center py-8 text-white/60">
                        {emptyExpensesMessage}
                      </td>
                    </tr>
                  ) : (
                    displayExpenses.map((expense: any) => (
                      <tr key={expense.id} className="hover:bg-white/5 transition-colors">
                        <td className="expenses-col-date fees-cell-amount">
                          {formatDateDDMMYYYY(expense.expense_date)}
                        </td>
                        <td className="expenses-col-category">
                          <span className="fees-cell-name" title={expense.subcategory ? `${expense.category} - ${expense.subcategory}` : expense.category}>
                            {expense.category}
                            {expense.subcategory && (
                              <span className="text-white/55"> - {expense.subcategory}</span>
                            )}
                          </span>
                        </td>
                        <td className="expenses-col-amount fees-cell-amount font-semibold text-right text-amber-200">
                          {formatMoney(expense.amount)}
                        </td>
                        <td className="expenses-col-vendor">
                          <span className="fees-cell-name" title={expense.vendor_name || undefined}>
                            {expense.vendor_name || '—'}
                          </span>
                        </td>
                        <td className="expenses-col-requested">
                          <span className="fees-cell-name" title={expense.requested_by_name || undefined}>
                            {expense.requested_by_name || '—'}
                          </span>
                        </td>
                        <td className="expenses-col-invoice">
                          <div className="flex flex-col gap-1">
                            {expense.bill_url ? (
                              <a
                                href={`${API_URL.replace('/api', '')}${expense.bill_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-300 hover:text-primary-200 font-medium text-xs"
                                title="View Invoice"
                              >
                                Invoice
                              </a>
                            ) : (
                              <span className="text-white/50 text-xs">No invoice</span>
                            )}
                            {expense.payment_receipt_url && (
                              <a
                                href={`${API_URL.replace('/api', '')}${expense.payment_receipt_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-300 hover:text-emerald-200 font-medium text-xs"
                                title="View Payment Receipt"
                              >
                                Receipt
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="expenses-col-status">
                          <span className={expenseStatusBadgeClass(expense.status)}>
                            {expense.status}
                          </span>
                        </td>
                        {!isTeacher && (
                          <td className="fees-col-actions expenses-col-actions">
                            <div className="flex items-center gap-2">
                              {canApprove && expense.status === 'Pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => approveExpenseMutation.mutate(expense.id)}
                                    disabled={approveExpenseMutation.isLoading}
                                    className="p-1.5 text-emerald-300 hover:bg-white/10 rounded disabled:opacity-50"
                                    title="Approve"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedExpense(expense)
                                      setShowRejectModal(true)
                                    }}
                                    className="p-1.5 text-red-300 hover:bg-white/10 rounded"
                                    title="Reject"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </>
                              )}
                              {canPay && expense.status === 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedExpense(expense)
                                    setPaymentData({
                                      payment_mode: normalizeExpensePaymentMode(expense.payment_mode),
                                      transaction_id: expense.transaction_id || '',
                                      payment_remarks: expense.payment_remarks || '',
                                    })
                                    resetPaymentReceipt()
                                    setShowPayModal(true)
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                                  title="Mark as Paid"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Pay
                                </button>
                              )}
                              {canManageExpenses && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(expense)}
                                    className="p-1.5 text-blue-300 hover:bg-white/10 rounded"
                                    title="Edit expense"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(expense)}
                                    disabled={deleteExpenseMutation.isLoading}
                                    className="p-1.5 text-red-300 hover:bg-white/10 rounded disabled:opacity-50"
                                    title="Delete expense"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {!isLoading && displayExpenses.length > 0 ? (
                  <tfoot>
                    <tr className="fees-table-totals-row">
                      <td colSpan={2} className="expenses-col-date text-left font-semibold text-white/90">
                        <span className="fees-table-totals-label">
                          <span>Total</span>
                          <span className="fees-table-totals-count">
                            {displayExpenses.length}{' '}
                            {hasActiveFilters ? 'matching ' : ''}
                            expense{displayExpenses.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </td>
                      <td className="expenses-col-amount fees-cell-amount font-semibold text-right text-amber-200">
                        <span className="block text-xs font-normal text-white/55">Total amount</span>
                        {formatMoney(expenseTotalAmount)}
                      </td>
                      <td colSpan={isTeacher ? 4 : 5} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </div>
          )}
        </div>

        {/* Apply / Edit Expense Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="glass-card p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="page-title">
                    {editingExpense
                      ? 'Edit Expense'
                      : isTeacher
                      ? 'Apply for Expense'
                      : 'Add Expense'}
                  </h2>
                  {editingExpense && (
                    <p className="page-subtitle mt-1">
                      Status:{' '}
                      <span className={expenseStatusBadgeClass(editingExpense.status)}>
                        {editingExpense.status}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={resetExpenseForm}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text mb-2">Category *</label>
                    <SelectField
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="select-field"
                      required
                      disabled={!expenseCategories?.length}
                    >
                      <option value="">Select Category</option>
                      {expenseCategories?.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </SelectField>
                    {!expenseCategories?.length && (
                      <p className="mt-1 text-xs text-amber-700">
                        Add categories in Master Data → Expenses → Category.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="label-text mb-2">Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="input-field placeholder-slate-400"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="expense_date" className="label-text mb-2">
                    Expense Date <span className="text-red-300">*</span>
                  </label>
                  <DdMmYyyyDateField
                    id="expense_date"
                    value={formData.expense_date}
                    onChange={(iso) => setFormData({ ...formData, expense_date: iso })}
                    onInvalid={(msg) => alert(msg)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="vendor_name" className="label-text mb-2">
                    Vendor Name <span className="text-white/50 font-normal">(optional)</span>
                  </label>
                  <input
                    id="vendor_name"
                    type="text"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="input-field placeholder-slate-400"
                    placeholder="e.g. ABC Stationery, Local Supplier"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="label-text mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="input-field placeholder-slate-400"
                    placeholder="Describe the expense..."
                  />
                </div>

                {/* Invoice Upload */}
                <div>
                  <label className="label-text mb-2">Attach Invoice/Bill</label>
                  <input
                    id="invoice-input"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="space-y-2">
                    {editingExpense && existingBillUrl && !billMarkedForRemoval && !invoiceFile && !invoicePreview && (
                      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <svg className="w-8 h-8 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="min-w-0">
                            <p className="text-sm text-slate-800 font-medium">Current invoice attached</p>
                            <a
                              href={`${uploadsBaseUrl}${existingBillUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                            >
                              View invoice
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <label
                            htmlFor="invoice-input"
                            className="px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 cursor-pointer"
                          >
                            Replace
                          </label>
                          <button
                            type="button"
                            onClick={removeExistingBill}
                            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {!invoiceFile && !invoicePreview && (!existingBillUrl || billMarkedForRemoval || !editingExpense) && (
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-primary-400 bg-slate-50 transition-colors">
                        <label
                          htmlFor="invoice-input"
                          className="cursor-pointer flex flex-col items-center space-y-2"
                        >
                          <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-sm text-slate-500">
                            {editingExpense ? 'Upload a new invoice/bill' : 'Click to upload invoice/bill'}
                          </span>
                          <span className="text-xs text-slate-600">Images, PDF, or Documents (Max 10MB)</span>
                        </label>
                      </div>
                    )}

                    {invoicePreview && (
                      <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <img
                          src={invoicePreview}
                          alt="Invoice preview"
                          className="max-h-48 mx-auto rounded"
                        />
                        <button
                          type="button"
                          onClick={removeInvoice}
                          className="absolute top-2 right-2 p-1 bg-red-500/80 text-slate-900 rounded hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <p className="text-xs text-slate-500 mt-2 text-center">{invoiceFile?.name}</p>
                      </div>
                    )}

                    {invoiceFile && !invoicePreview && (
                      <div className="relative border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <p className="text-sm text-slate-800 font-medium">{invoiceFile.name}</p>
                            <p className="text-xs text-slate-600">
                              {(invoiceFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeInvoice}
                          className="p-1 text-red-400 hover:text-red-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {editingExpense?.status === 'Paid' && (
                  <>
                    <div>
                      <label className="label-text mb-2">Payment Receipt</label>
                      <input
                        id="edit-receipt-input"
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleEditReceiptChange}
                        className="hidden"
                      />
                      <div className="space-y-2">
                        {existingReceiptUrl && !receiptMarkedForRemoval && !editReceiptFile && !editReceiptPreview && (
                          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <svg className="w-8 h-8 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="min-w-0">
                                <p className="text-sm text-slate-800 font-medium">Current payment receipt</p>
                                <a
                                  href={`${uploadsBaseUrl}${existingReceiptUrl}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium"
                                >
                                  View receipt
                                </a>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <label
                                htmlFor="edit-receipt-input"
                                className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 cursor-pointer"
                              >
                                Replace
                              </label>
                              <button
                                type="button"
                                onClick={removeExistingReceipt}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        )}

                        {!editReceiptFile && !editReceiptPreview && (!existingReceiptUrl || receiptMarkedForRemoval) && (
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-emerald-400 bg-slate-50 transition-colors">
                            <label
                              htmlFor="edit-receipt-input"
                              className="cursor-pointer flex flex-col items-center space-y-1"
                            >
                              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <span className="text-sm text-slate-600">Upload payment receipt</span>
                              <span className="text-xs text-slate-500">Image, PDF, or document (max 10MB)</span>
                            </label>
                          </div>
                        )}

                        {editReceiptPreview && (
                          <div className="relative border border-slate-200 rounded-lg p-3 bg-slate-50">
                            <img
                              src={editReceiptPreview}
                              alt="Receipt preview"
                              className="max-h-36 mx-auto rounded"
                            />
                            <button
                              type="button"
                              onClick={resetEditReceipt}
                              className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <p className="text-xs text-slate-600 mt-2 text-center">{editReceiptFile?.name}</p>
                          </div>
                        )}

                        {editReceiptFile && !editReceiptPreview && (
                          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between">
                            <p className="text-sm text-slate-800 font-medium truncate pr-2">{editReceiptFile.name}</p>
                            <button
                              type="button"
                              onClick={resetEditReceipt}
                              className="text-red-600 hover:text-red-800 text-sm shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="label-text mb-2">Payment Remarks</label>
                      <textarea
                        value={formData.payment_remarks}
                        onChange={(e) => setFormData({ ...formData, payment_remarks: e.target.value })}
                        rows={2}
                        className="input-field placeholder-slate-400"
                        placeholder="Payment notes..."
                      />
                    </div>
                  </>
                )}

                {(!isTeacher || editingExpense) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-text mb-2">Payment Mode</label>
                      <SelectField
                        value={formData.payment_mode}
                        onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                        className="select-field"
                      >
                        {getExpensePaymentModeOptions(formData.payment_mode).map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div>
                      <label className="label-text mb-2">Bill Number</label>
                      <input
                        type="text"
                        value={formData.bill_number}
                        onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                        className="input-field placeholder-slate-400"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetExpenseForm}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createExpenseMutation.isLoading || updateExpenseMutation.isLoading}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {editingExpense
                      ? updateExpenseMutation.isLoading
                        ? 'Saving...'
                        : 'Save Changes'
                      : createExpenseMutation.isLoading
                      ? 'Submitting...'
                      : isTeacher
                      ? 'Submit Request'
                      : 'Create Expense'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayModal && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="glass-card p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="page-title">Process Payment</h2>
                  <p className="page-subtitle">Mark expense as paid</p>
                </div>
                <button
                  onClick={closePayModal}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">Expense Details</p>
                    <span className="badge-info">Approved</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-800">
                      <strong>Category:</strong> {selectedExpense.category}
                      {selectedExpense.subcategory && <span className="text-slate-600"> - {selectedExpense.subcategory}</span>}
                    </p>
                    <p className="text-lg font-bold text-emerald-700">
                      <strong>Amount:</strong> {formatMoney(selectedExpense.amount)}
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Vendor:</strong> {selectedExpense.vendor_name || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Requested By:</strong> {selectedExpense.requested_by_name || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Date:</strong> {formatDateDDMMYYYY(selectedExpense.expense_date)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="label-text mb-2">Payment Mode *</label>
                  <SelectField
                    value={paymentData.payment_mode}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
                    className="select-field"
                    required
                  >
                    {getExpensePaymentModeOptions(paymentData.payment_mode).map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <label className="label-text mb-2">Transaction ID</label>
                  <input
                    type="text"
                    value={paymentData.transaction_id}
                    onChange={(e) => setPaymentData({ ...paymentData, transaction_id: e.target.value })}
                    className="input-field placeholder-slate-400"
                    placeholder="Enter transaction ID if applicable"
                  />
                </div>

                <div>
                  <label className="label-text mb-2">Upload Receipt (optional)</label>
                  <div className="space-y-2">
                    {!paymentReceiptFile && !paymentReceiptPreview && (
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-primary-400 bg-slate-50 transition-colors">
                        <input
                          id="payment-receipt-input"
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          onChange={handlePaymentReceiptChange}
                          className="hidden"
                        />
                        <label
                          htmlFor="payment-receipt-input"
                          className="cursor-pointer flex flex-col items-center space-y-1"
                        >
                          <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="text-sm text-slate-600">Click to upload payment receipt</span>
                          <span className="text-xs text-slate-500">Image, PDF, or document (max 10MB)</span>
                        </label>
                      </div>
                    )}

                    {paymentReceiptPreview && (
                      <div className="relative border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <img
                          src={paymentReceiptPreview}
                          alt="Receipt preview"
                          className="max-h-36 mx-auto rounded"
                        />
                        <button
                          type="button"
                          onClick={resetPaymentReceipt}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <p className="text-xs text-slate-600 mt-2 text-center">{paymentReceiptFile?.name}</p>
                      </div>
                    )}

                    {paymentReceiptFile && !paymentReceiptPreview && (
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between">
                        <p className="text-sm text-slate-800 font-medium truncate pr-2">{paymentReceiptFile.name}</p>
                        <button
                          type="button"
                          onClick={resetPaymentReceipt}
                          className="text-red-600 hover:text-red-800 text-sm shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="label-text mb-2">Payment Remarks</label>
                  <textarea
                    value={paymentData.payment_remarks}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_remarks: e.target.value })}
                    rows={2}
                    className="input-field placeholder-slate-400"
                    placeholder="Any additional notes..."
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closePayModal}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      payExpenseMutation.mutate({
                        expenseId: selectedExpense.id,
                        data: paymentData,
                        receiptFile: paymentReceiptFile,
                      })
                    }
                    disabled={payExpenseMutation.isLoading || !paymentData.payment_mode}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium flex items-center space-x-2"
                  >
                    {payExpenseMutation.isLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Mark as Paid</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 ">
            <div className="glass-card p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="page-title">Reject Expense</h2>
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setSelectedExpense(null)
                    setRejectionReason('')
                  }}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-slate-600">
                    <strong>Category:</strong> {selectedExpense.category}
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Amount:</strong> {formatMoney(selectedExpense.amount)}
                  </p>
                </div>

                <div>
                  <label className="label-text mb-2">Rejection Reason *</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="input-field placeholder-slate-400"
                    placeholder="Please provide a reason for rejection..."
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectModal(false)
                      setSelectedExpense(null)
                      setRejectionReason('')
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => rejectExpenseMutation.mutate({ expenseId: selectedExpense.id, reason: rejectionReason })}
                    disabled={!rejectionReason || rejectExpenseMutation.isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {rejectExpenseMutation.isLoading ? 'Rejecting...' : 'Reject Expense'}
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
