'use client'

import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect, useMemo } from 'react'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterBar,
  PageFilterClearButton,
  PageFilterField,
  PageFilterRow,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { invalidateFinanceQueries } from '@/lib/invalidateFinanceQueries'
import SalaryInvoicePrint, { type SalaryInvoiceData } from '@/components/salaries/SalaryInvoicePrint'
import BankNameSearchInput from '@/components/BankNameSearchInput'
import { formatMoney } from '@/lib/formatMoney'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

function payoutFieldsFromStructure(structure: any) {
  return {
    payout_bank_name: structure?.bank_name || '',
    payout_ifsc_code: structure?.ifsc_code || '',
    payout_account_number: structure?.account_number || '',
    payout_account_holder_name: structure?.account_holder_name || '',
    payout_upi_id: structure?.upi_id || '',
  }
}

function hasSavedBankDetails(data: {
  payout_bank_name?: string
  payout_ifsc_code?: string
  payout_account_number?: string
}) {
  return !!(
    data.payout_bank_name?.trim() &&
    data.payout_ifsc_code?.trim() &&
    data.payout_account_number?.trim()
  )
}

export default function SalariesPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const {
    scopedHeaders,
    branchScopeKey,
    isAllBranches,
    branch,
    requireBranchForWrite,
    requireAcademicYearSelected,
  } = useBranchYearScope()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'structures' | 'payments'>('structures')
  const [showStructureForm, setShowStructureForm] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [editingStructure, setEditingStructure] = useState<any>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [structureSearch, setStructureSearch] = useState('')
  const [structureStatusFilter, setStructureStatusFilter] = useState('')
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentMonthFilter, setPaymentMonthFilter] = useState('')

  const [structureFormData, setStructureFormData] = useState({
    staff_id: '',
    basic_salary: '',
    allowances: '0',
    deductions: '0',
    net_salary: '',
    effective_from: '',
    bank_name: '',
    ifsc_code: '',
    account_number: '',
    account_holder_name: '',
    upi_id: '',
  })

  const [paymentFormData, setPaymentFormData] = useState({
    staff_id: '',
    salary_structure_id: '',
    month: '',
    year: new Date().getFullYear().toString(),
    payment_date: '',
    payment_mode: 'Bank Transfer',
    transaction_id: '',
    remarks: '',
    leave_deduction: '',
    penalties: '0',
    adjustments: '0',
    net_salary_to_receive: '',
    payout_bank_name: '',
    payout_ifsc_code: '',
    payout_account_number: '',
    payout_account_holder_name: '',
    payout_upi_id: '',
    save_payout_to_structure: false,
  })

  const [selectedStructure, setSelectedStructure] = useState<any>(null)
  const [salaryInvoiceData, setSalaryInvoiceData] = useState<SalaryInvoiceData | null>(null)
  const [salaryInvoiceLoading, setSalaryInvoiceLoading] = useState(false)
  const canSetAdjustments = user?.role_name === 'School Admin' || user?.role_name === 'Principal' || user?.role_name === 'Super Admin'

  const openSalaryInvoice = async (paymentId: number) => {
    setSalaryInvoiceLoading(true)
    setSalaryInvoiceData(null)
    try {
      const response = await axios.get(`${API_URL}/salaries/payments/${paymentId}/invoice`, {
        params: {
          school_id: user?.school_id,
          academic_year_id: academicYear?.id,
        },
        headers: scopedHeaders,
      })
      setSalaryInvoiceData(response.data.data)
    } catch {
      alert('Failed to load salary invoice. Please try again.')
    } finally {
      setSalaryInvoiceLoading(false)
    }
  }

  // Active teachers (staff_id = user_id on salary structures)
  const { data: teachers } = useQuery(
    ['teachers', user?.school_id, 'active', branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/teachers`, {
        params: {
          school_id: user?.school_id,
          active_only: 'true',
        },
        headers: scopedHeaders,
      })
      return response.data.data || []
    },
    { enabled: !!user && !!token }
  )

  // Fetch salary structures
  const { data: structures, refetch: refetchStructures } = useQuery(
    ['salary-structures', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/salaries/structures`, {
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

  const activeTeacherOptions = useMemo(
    () =>
      (teachers || [])
        .map((t: any) => ({
          id: t.user_id,
          name: t.name,
          email: t.email,
          phone: t.phone,
          employee_id: t.employee_id,
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)),
    [teachers]
  )

  const staffIdsWithActiveStructure = useMemo(
    () =>
      new Set(
        (structures || []).filter((s: any) => !!s.is_active).map((s: any) => Number(s.staff_id))
      ),
    [structures]
  )

  const teachersForNewStructure = useMemo(
    () => activeTeacherOptions.filter((t) => !staffIdsWithActiveStructure.has(t.id)),
    [activeTeacherOptions, staffIdsWithActiveStructure]
  )

  const teachersForPayment = useMemo(
    () => activeTeacherOptions.filter((t) => staffIdsWithActiveStructure.has(t.id)),
    [activeTeacherOptions, staffIdsWithActiveStructure]
  )

  // Fetch salary payments
  const { data: payments, refetch: refetchPayments } = useQuery(
    ['salary-payments', user?.school_id, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/salaries/payments`, {
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

  // Calculate net salary automatically
  useEffect(() => {
    const basic = parseFloat(structureFormData.basic_salary || '0')
    const allowances = parseFloat(structureFormData.allowances || '0')
    const deductions = parseFloat(structureFormData.deductions || '0')
    const net = basic + allowances - deductions
    setStructureFormData((prev) => ({
      ...prev,
      net_salary: net > 0 ? net.toFixed(2) : '',
    }))
  }, [structureFormData.basic_salary, structureFormData.allowances, structureFormData.deductions])

  // Create salary structure mutation
  const createStructureMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/salaries/structures`,
        {
          ...data,
          school_id: user?.school_id,
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
        queryClient.invalidateQueries(['salary-structures'])
        refetchStructures()
        resetStructureForm()
        alert('Salary structure created successfully!')
      },
      onError: (error: any) => {
        console.error('Create salary structure error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to create salary structure'
        alert(errorMessage)
      },
    }
  )

  // Update salary structure mutation
  const updateStructureMutation = useMutation(
    async ({ id, data }: { id: number; data: any }) => {
      const response = await axios.put(
        `${API_URL}/salaries/structures/${id}`,
        {
          ...data,
          school_id: user?.school_id,
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
        queryClient.invalidateQueries(['salary-structures'])
        refetchStructures()
        resetStructureForm()
        alert('Salary structure updated successfully!')
      },
      onError: (error: any) => {
        console.error('Update salary structure error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to update salary structure'
        alert(errorMessage)
      },
    }
  )

  // Delete salary structure mutation
  const deleteStructureMutation = useMutation(
    async (id: number) => {
      const response = await axios.delete(`${API_URL}/salaries/structures/${id}`, {
        headers: scopedHeaders,
      })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['salary-structures'])
        refetchStructures()
        alert('Salary structure deleted successfully!')
      },
      onError: (error: any) => {
        console.error('Delete salary structure error:', error)
        const errorMessage =
          error.response?.data?.error || error.message || 'Failed to delete salary structure'
        alert(errorMessage)
      },
    }
  )

  // Process salary payment mutation
  const processPaymentMutation = useMutation(
    async (data: any) => {
      const response = await axios.post(
        `${API_URL}/salaries/pay`,
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
      onSuccess: (result: any) => {
        queryClient.invalidateQueries(['salary-payments'])
        invalidateFinanceQueries(queryClient, user?.school_id, academicYear?.id)
        refetchPayments()
        resetPaymentForm()
        const paymentId = result?.data?.id
        if (paymentId) {
          openSalaryInvoice(paymentId)
        } else {
          alert('Salary payment processed successfully!')
        }
      },
      onError: (error: any) => {
        console.error('Process salary payment error:', error)
        const errorMessage =
          error.response?.data?.error ||
          error.response?.data?.errors?.[0]?.msg ||
          error.message ||
          'Failed to process salary payment'
        alert(errorMessage)
      },
    }
  )

  const handleStructureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!structureFormData.staff_id || !structureFormData.basic_salary || !structureFormData.net_salary) {
      alert('Please fill in all required fields')
      return
    }

    const payload = {
      staff_id: parseInt(structureFormData.staff_id),
      basic_salary: parseFloat(structureFormData.basic_salary),
      allowances: parseFloat(structureFormData.allowances || '0'),
      deductions: parseFloat(structureFormData.deductions || '0'),
      net_salary: parseFloat(structureFormData.net_salary),
      effective_from: structureFormData.effective_from || null,
      bank_name: structureFormData.bank_name.trim() || null,
      ifsc_code: structureFormData.ifsc_code.trim().toUpperCase() || null,
      account_number: structureFormData.account_number.trim() || null,
      account_holder_name: structureFormData.account_holder_name.trim() || null,
      upi_id: structureFormData.upi_id.trim() || null,
    }

    if (editingStructure) {
      updateStructureMutation.mutate({ id: editingStructure.id, data: payload })
    } else {
      createStructureMutation.mutate(payload)
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentFormData.staff_id || !paymentFormData.salary_structure_id || !paymentFormData.month || !paymentFormData.year) {
      alert('Please fill in all required fields')
      return
    }

    if (!paymentFormData.net_salary_to_receive || parseFloat(paymentFormData.net_salary_to_receive) < 0) {
      alert('Net salary to receive must be a positive number')
      return
    }

    if (paymentFormData.payment_mode === 'Bank Transfer') {
      if (!hasSavedBankDetails(paymentFormData)) {
        alert('Bank transfer requires bank name, IFSC code, and account number.')
        return
      }
    } else if (paymentFormData.payment_mode === 'Online') {
      if (!paymentFormData.payout_upi_id?.trim()) {
        alert('Online payment requires a UPI ID (PhonePe, GPay, Paytm, etc.).')
        return
      }
    }

    const payload = {
      staff_id: parseInt(paymentFormData.staff_id),
      salary_structure_id: parseInt(paymentFormData.salary_structure_id),
      month: parseInt(paymentFormData.month),
      year: parseInt(paymentFormData.year),
      payment_date: paymentFormData.payment_date || new Date().toISOString().split('T')[0],
      payment_mode: paymentFormData.payment_mode,
      transaction_id: paymentFormData.transaction_id || null,
      remarks: paymentFormData.remarks || null,
      leave_deduction: canSetAdjustments ? parseFloat(paymentFormData.leave_deduction || '0') : undefined,
      penalties: canSetAdjustments ? parseFloat(paymentFormData.penalties || '0') : undefined,
      adjustments: canSetAdjustments ? parseFloat(paymentFormData.adjustments || '0') : undefined,
      payout_bank_name:
        paymentFormData.payment_mode === 'Bank Transfer' ? paymentFormData.payout_bank_name : null,
      payout_ifsc_code:
        paymentFormData.payment_mode === 'Bank Transfer' ? paymentFormData.payout_ifsc_code : null,
      payout_account_number:
        paymentFormData.payment_mode === 'Bank Transfer' ? paymentFormData.payout_account_number : null,
      payout_account_holder_name:
        paymentFormData.payment_mode === 'Bank Transfer'
          ? paymentFormData.payout_account_holder_name || null
          : null,
      payout_upi_id: paymentFormData.payment_mode === 'Online' ? paymentFormData.payout_upi_id : null,
      save_payout_to_structure: paymentFormData.save_payout_to_structure,
    }

    processPaymentMutation.mutate(payload)
  }

  const handleStructureChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setStructureFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const lookupIfscBank = async (ifsc: string) => {
    const code = ifsc.trim().toUpperCase()
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return
    try {
      const response = await axios.get(`${API_URL}/banks/ifsc/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const bank = response.data.data?.bank
      if (bank) {
        setStructureFormData((prev) => ({ ...prev, bank_name: bank }))
      }
    } catch {
      // IFSC not found — user can enter bank manually
    }
  }

  const lookupPayoutIfscBank = async (ifsc: string) => {
    const code = ifsc.trim().toUpperCase()
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) return
    try {
      const response = await axios.get(`${API_URL}/banks/ifsc/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const bank = response.data.data?.bank
      if (bank) {
        setPaymentFormData((prev) => ({ ...prev, payout_bank_name: bank }))
      }
    } catch {
      // IFSC not found — user can enter bank manually
    }
  }

  const handlePaymentChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined

    if (name === 'salary_structure_id') {
      const structure = structures?.find((s: any) => s.id === parseInt(value))
      setSelectedStructure(structure || null)
      setPaymentFormData((prev) => ({
        ...prev,
        salary_structure_id: value,
        ...(structure ? payoutFieldsFromStructure(structure) : {}),
        save_payout_to_structure: false,
      }))
      return
    }

    setPaymentFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleStructureTeacherChange = (staffId: string) => {
    setSelectedStaffId(staffId)
    setStructureFormData((prev) => ({ ...prev, staff_id: staffId }))
  }

  const handlePaymentTeacherChange = (staffId: string) => {
    setSelectedStaffId(staffId)
    setPaymentFormData((prev) => ({
      ...prev,
      staff_id: staffId,
      salary_structure_id: '',
    }))
    setSelectedStructure(null)
  }

  const getTeacherLabel = (t: { name: string; employee_id?: string; email?: string }) => {
    const parts = [t.name]
    if (t.employee_id) parts.push(t.employee_id)
    return parts.join(' — ')
  }

  // When staff is selected for payment, load their salary structure
  useEffect(() => {
    if (paymentFormData.staff_id && structures) {
      const staffStructure = structures.find(
        (s: any) => s.staff_id === parseInt(paymentFormData.staff_id) && s.is_active
      )
      if (staffStructure) {
        setSelectedStructure(staffStructure)
        setPaymentFormData((prev) => ({
          ...prev,
          salary_structure_id: String(staffStructure.id),
          ...payoutFieldsFromStructure(staffStructure),
          save_payout_to_structure: false,
        }))
      }
    }
  }, [paymentFormData.staff_id, structures])

  // Auto-calculate net salary to receive
  useEffect(() => {
    if (selectedStructure && paymentFormData.month && paymentFormData.year) {
      const baseNetSalary = parseFloat(selectedStructure.net_salary || 0)
      const leaveDeduction = parseFloat(paymentFormData.leave_deduction || 0)
      const penalties = parseFloat(paymentFormData.penalties || 0)
      const adjustments = parseFloat(paymentFormData.adjustments || 0)

      // Formula: Base Net Salary - Leave Deductions - Penalties + Adjustments
      const netSalaryToReceive = Math.max(0, baseNetSalary - leaveDeduction - penalties + adjustments)

      setPaymentFormData((prev) => ({
        ...prev,
        net_salary_to_receive: netSalaryToReceive.toFixed(2),
      }))
    }
  }, [
    selectedStructure,
    paymentFormData.leave_deduction,
    paymentFormData.penalties,
    paymentFormData.adjustments,
    paymentFormData.month,
    paymentFormData.year,
  ])

  // Auto-fetch leave deduction when staff, month, and year are selected
  useEffect(() => {
    if (
      canSetAdjustments &&
      paymentFormData.staff_id &&
      paymentFormData.month &&
      paymentFormData.year &&
      !paymentFormData.leave_deduction
    ) {
      fetchLeaveDeduction()
    }
  }, [paymentFormData.staff_id, paymentFormData.month, paymentFormData.year])

  const fetchLeaveDeduction = async () => {
    if (!paymentFormData.staff_id || !paymentFormData.month || !paymentFormData.year || !selectedStructure) return

    try {
      const response = await axios.get(`${API_URL}/salaries/calculate-leaves`, {
        params: {
          staff_id: paymentFormData.staff_id,
          month: paymentFormData.month,
          year: paymentFormData.year,
        },
        headers: scopedHeaders,
      })

      const { unpaid_days } = response.data.data
      if (unpaid_days > 0 && selectedStructure) {
        // Calculate daily salary and deduction
        const dailySalary = parseFloat(selectedStructure.net_salary) / 30
        const deduction = dailySalary * unpaid_days

        setPaymentFormData((prev) => ({
          ...prev,
          leave_deduction: deduction.toFixed(2),
        }))
      }
    } catch (error) {
      console.error('Error fetching leave deduction:', error)
      // Don't show error, just continue without auto-calculation
    }
  }

  const handleEditStructure = async (structure: any) => {
    try {
      const response = await axios.get(`${API_URL}/salaries/structures/${structure.id}`, {
        headers: scopedHeaders,
      })

      const structureData = response.data.data
      const staffMember = activeTeacherOptions.find((s) => s.id === structureData.staff_id)
      if (staffMember) {
        setSelectedStaffId(String(staffMember.id))
      }

      setStructureFormData({
        staff_id: String(structureData.staff_id || ''),
        basic_salary: String(structureData.basic_salary || ''),
        allowances: String(structureData.allowances || '0'),
        deductions: String(structureData.deductions || '0'),
        net_salary: String(structureData.net_salary || ''),
        effective_from: structureData.effective_from
          ? formatDateForInput(structureData.effective_from)
          : '',
        bank_name: structureData.bank_name || '',
        ifsc_code: structureData.ifsc_code || '',
        account_number: structureData.account_number || '',
        account_holder_name: structureData.account_holder_name || '',
        upi_id: structureData.upi_id || '',
      })

      setEditingStructure(structureData)
      setShowStructureForm(true)
    } catch (error: any) {
      console.error('Error fetching salary structure:', error)
      alert('Failed to load salary structure for editing')
    }
  }

  const handleDeleteStructure = (structure: any) => {
    if (
      confirm(
        `Are you sure you want to delete the salary structure for "${structure.staff_name}"?\n\nThis action cannot be undone.`
      )
    ) {
      deleteStructureMutation.mutate(structure.id)
    }
  }

  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return ''
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString
      }
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

  const resetStructureForm = () => {
    setStructureFormData({
      staff_id: '',
      basic_salary: '',
      allowances: '0',
      deductions: '0',
      net_salary: '',
      effective_from: '',
      bank_name: '',
      ifsc_code: '',
      account_number: '',
      account_holder_name: '',
      upi_id: '',
    })
    setSelectedStaffId('')
    setEditingStructure(null)
    setShowStructureForm(false)
  }

  const resetPaymentForm = () => {
    setPaymentFormData({
      staff_id: '',
      salary_structure_id: '',
      month: '',
      year: new Date().getFullYear().toString(),
      payment_date: '',
      payment_mode: 'Bank Transfer',
      transaction_id: '',
      remarks: '',
      leave_deduction: '',
      penalties: '0',
      adjustments: '0',
      net_salary_to_receive: '',
      payout_bank_name: '',
      payout_ifsc_code: '',
      payout_account_number: '',
      payout_account_holder_name: '',
      payout_upi_id: '',
      save_payout_to_structure: false,
    })
    setSelectedStaffId('')
    setSelectedStructure(null)
    setShowPaymentForm(false)
  }

  const paymentBankSaved = hasSavedBankDetails(paymentFormData)
  const paymentUpiSaved = !!paymentFormData.payout_upi_id?.trim()

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1] || ''
  }

  const formatPaymentPeriod = (month: number, year: number) => {
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const y = String(year).slice(-2)
    return `${shortMonths[month - 1] || getMonthName(month).slice(0, 3)} '${y}`
  }

  const formatCompactDate = (dateString: string) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  const formatCompactAmount = (value: number | string) => formatMoney(value, { compact: true })

  const shortPaymentMode = (mode: string) => {
    if (mode === 'Bank Transfer') return 'Bank'
    if (mode === 'Net Banking') return 'Net'
    if (mode === 'UPI') return 'UPI'
    return mode
  }

  const renderPaymentAdjustments = (payment: any) => {
    const leave = parseFloat(payment.leave_deduction || 0)
    const penalties = parseFloat(payment.penalties || 0)
    const adjustments = parseFloat(payment.adjustments || 0)
    if (leave === 0 && penalties === 0 && adjustments === 0) {
      return <span className="text-white/40">—</span>
    }
    return (
      <div className="salaries-pay-adj-stack">
        {leave > 0 && <span className="text-red-300">Leave {formatCompactAmount(leave)}</span>}
        {penalties > 0 && <span className="text-red-300">Penalty {formatCompactAmount(penalties)}</span>}
        {adjustments !== 0 && (
          <span className={adjustments > 0 ? 'text-emerald-300' : 'text-red-300'}>
            Adj {adjustments > 0 ? '+' : '−'}{formatCompactAmount(Math.abs(adjustments))}
          </span>
        )}
      </div>
    )
  }

  const showSalariesForm = showStructureForm || showPaymentForm

  const displayStructures = useMemo(() => {
    return (structures || []).filter((structure: any) => {
      if (structureStatusFilter === 'active' && !structure.is_active) return false
      if (structureStatusFilter === 'inactive' && structure.is_active) return false
      if (!structureSearch.trim()) return true
      const q = structureSearch.toLowerCase()
      return (
        structure.staff_name?.toLowerCase().includes(q) ||
        String(structure.basic_salary ?? '').includes(q) ||
        String(structure.net_salary ?? '').includes(q)
      )
    })
  }, [structures, structureSearch, structureStatusFilter])

  const displayPayments = useMemo(() => {
    return (payments || []).filter((payment: any) => {
      if (paymentMonthFilter && String(payment.month) !== paymentMonthFilter) return false
      if (!paymentSearch.trim()) return true
      const q = paymentSearch.toLowerCase()
      return (
        payment.staff_name?.toLowerCase().includes(q) ||
        getMonthName(payment.month).toLowerCase().includes(q) ||
        String(payment.year ?? '').includes(q) ||
        payment.payment_mode?.toLowerCase().includes(q) ||
        payment.transaction_id?.toLowerCase().includes(q) ||
        String(payment.net_salary_to_receive ?? payment.net_salary ?? '').includes(q)
      )
    })
  }, [payments, paymentSearch, paymentMonthFilter])

  const hasStructureFilters = !!(structureSearch || structureStatusFilter)
  const hasPaymentFilters = !!(paymentSearch || paymentMonthFilter)

  const structureExport = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Salary Structures',
      filename: 'salary_structures',
      getSubtitle: () => {
        const parts: string[] = []
        if (structureSearch.trim()) parts.push(`Search: ${structureSearch.trim()}`)
        if (structureStatusFilter) parts.push(`Status: ${structureStatusFilter}`)
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'basic_salary', label: 'Basic Salary' },
        { key: 'allowances', label: 'Allowances' },
        { key: 'deductions', label: 'Deductions' },
        { key: 'net_salary', label: 'Net Salary' },
        { key: 'effective_from', label: 'Effective From' },
        { key: 'status', label: 'Status' },
      ],
      getRows: () =>
        displayStructures.map((s: any) => ({
          staff_name: s.staff_name || '',
          basic_salary: s.basic_salary ?? '',
          allowances: s.allowances ?? '',
          deductions: s.deductions ?? '',
          net_salary: s.net_salary ?? '',
          effective_from: s.effective_from || '',
          status: s.is_active ? 'Active' : 'Inactive',
        })),
    },
  })

  const paymentExport = usePageExport({
    enabled: !!token,
    headers: scopedHeaders,
    config: {
      mode: 'data',
      title: 'Salary Payments',
      filename: 'salary_payments',
      getSubtitle: () => {
        const parts: string[] = []
        if (paymentSearch.trim()) parts.push(`Search: ${paymentSearch.trim()}`)
        if (paymentMonthFilter) parts.push(`Month: ${getMonthName(Number(paymentMonthFilter))}`)
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'staff_name', label: 'Staff Name' },
        { key: 'month', label: 'Month' },
        { key: 'year', label: 'Year' },
        { key: 'amount', label: 'Amount' },
        { key: 'payment_date', label: 'Payment Date' },
        { key: 'payment_mode', label: 'Payment Mode' },
        { key: 'status', label: 'Status' },
      ],
      getRows: () =>
        displayPayments.map((p: any) => ({
          staff_name: p.staff_name || '',
          month: getMonthName(p.month),
          year: p.year ?? '',
          amount: p.amount ?? '',
          payment_date: p.payment_date || '',
          payment_mode: p.payment_mode || '',
          status: p.status || '',
        })),
    },
  })

  const paymentMonthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1),
        label: getMonthName(index + 1),
      })),
    []
  )

  const yearGuard = requireAcademicYearSelected()
  if (yearGuard) {
    return (
      <Layout>
        <div className="page-container">
          <div className="alert-warning">{yearGuard}</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className={showSalariesForm ? 'page-container' : 'fees-page-layout'}>
        <div className={showSalariesForm ? undefined : 'shrink-0 fees-page-toolbar'}>
          <div className="glass-card p-2 sm:p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('structures')
                    resetStructureForm()
                    resetPaymentForm()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === 'structures'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Salary Structures
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('payments')
                    resetStructureForm()
                    resetPaymentForm()
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === 'payments'
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Salary Payments
                </button>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeTab === 'structures' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (showStructureForm) {
                        resetStructureForm()
                      } else {
                        setShowStructureForm(true)
                      }
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 shadow-lg whitespace-nowrap"
                  >
                    {showStructureForm ? 'Cancel' : 'New Salary Structure'}
                  </button>
                )}
                {activeTab === 'payments' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (showPaymentForm) {
                        resetPaymentForm()
                      } else {
                        setShowPaymentForm(true)
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-green-700 shadow-lg whitespace-nowrap"
                  >
                    {showPaymentForm ? 'Cancel' : 'Process Payment'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Salary Structure Form */}
        {activeTab === 'structures' && showStructureForm && (
          <div className="glass-card p-6">
            <h2 className="modal-title text-xl mb-4">
              {editingStructure ? 'Edit Salary Structure' : 'Create New Salary Structure'}
            </h2>
            <form onSubmit={handleStructureSubmit} className="space-y-4">
              <div>
                <label htmlFor="structure_teacher" className="label-text">
                  Select Teacher <span className="text-red-600">*</span>
                </label>
                {editingStructure ? (
                  <input
                    type="text"
                    id="structure_teacher"
                    value={
                      editingStructure.staff_name ||
                      activeTeacherOptions.find((t) => t.id === Number(structureFormData.staff_id))?.name ||
                      ''
                    }
                    disabled
                    className="input-field opacity-60 cursor-not-allowed"
                  />
                ) : (
                  <>
                    <SelectField
                      id="structure_teacher"
                      value={structureFormData.staff_id}
                      onChange={(e) => handleStructureTeacherChange(e.target.value)}
                      required
                      className="select-field w-full"
                    >
                      <option value="">
                        {teachersForNewStructure.length === 0
                          ? 'No teachers available (all have salary structures)'
                          : 'Select active teacher'}
                      </option>
                      {teachersForNewStructure.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {getTeacherLabel(teacher)}
                        </option>
                      ))}
                    </SelectField>
                    {teachersForNewStructure.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        Every active teacher already has a salary structure for this academic year.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="basic_salary" className="label-text">
                    Basic Salary (₹) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    id="basic_salary"
                    name="basic_salary"
                    value={structureFormData.basic_salary}
                    onChange={handleStructureChange}
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="effective_from" className="label-text">
                    Effective From
                  </label>
                  <input
                    type="date"
                    id="effective_from"
                    name="effective_from"
                    value={structureFormData.effective_from}
                    onChange={handleStructureChange}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="allowances" className="label-text">
                    Allowances (₹)
                  </label>
                  <input
                    type="number"
                    id="allowances"
                    name="allowances"
                    value={structureFormData.allowances}
                    onChange={handleStructureChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="deductions" className="label-text">
                    Deductions (₹)
                  </label>
                  <input
                    type="number"
                    id="deductions"
                    name="deductions"
                    value={structureFormData.deductions}
                    onChange={handleStructureChange}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="net_salary" className="label-text">
                  Net Salary (₹) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  id="net_salary"
                  name="net_salary"
                  value={structureFormData.net_salary}
                  onChange={handleStructureChange}
                  required
                  min="0"
                  step="0.01"
                  placeholder="Auto-calculated"
                  className="input-field"
                />
                <p className="mt-1 text-xs text-slate-600">
                  Net Salary = Basic Salary + Allowances - Deductions
                </p>
              </div>

              <div className="border-t border-white/15 pt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Bank & UPI Details (for salary payout)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bank_name" className="label-text">Bank Name</label>
                    <BankNameSearchInput
                      value={structureFormData.bank_name}
                      onChange={(v) =>
                        setStructureFormData((prev) => ({ ...prev, bank_name: v }))
                      }
                      placeholder="Type to search bank name..."
                    />
                  </div>
                  <div>
                    <label htmlFor="ifsc_code" className="label-text">IFSC Code</label>
                    <input
                      type="text"
                      id="ifsc_code"
                      name="ifsc_code"
                      value={structureFormData.ifsc_code}
                      onChange={handleStructureChange}
                      onBlur={(e) => lookupIfscBank(e.target.value)}
                      placeholder="e.g. SBIN0001234"
                      maxLength={11}
                      className="input-field uppercase"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Enter valid IFSC to auto-fill bank name
                    </p>
                  </div>
                  <div>
                    <label htmlFor="account_number" className="label-text">Account Number</label>
                    <input
                      type="text"
                      id="account_number"
                      name="account_number"
                      value={structureFormData.account_number}
                      onChange={handleStructureChange}
                      placeholder="Bank account number"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label htmlFor="account_holder_name" className="label-text">Account Holder Name</label>
                    <input
                      type="text"
                      id="account_holder_name"
                      name="account_holder_name"
                      value={structureFormData.account_holder_name}
                      onChange={handleStructureChange}
                      placeholder="Name as per bank account"
                      className="input-field"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="upi_id" className="label-text">PhonePe / Google Pay UPI ID</label>
                    <input
                      type="text"
                      id="upi_id"
                      name="upi_id"
                      value={structureFormData.upi_id}
                      onChange={handleStructureChange}
                      placeholder="e.g. name@ybl or 9876543210@paytm"
                      className="input-field"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Optional UPI ID for PhonePe, GPay, or other UPI apps
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetStructureForm}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createStructureMutation.isLoading ||
                    updateStructureMutation.isLoading ||
                    (!editingStructure && teachersForNewStructure.length === 0)
                  }
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {editingStructure
                    ? updateStructureMutation.isLoading
                      ? 'Updating...'
                      : 'Update Salary Structure'
                    : createStructureMutation.isLoading
                    ? 'Creating...'
                    : 'Create Salary Structure'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Salary Payment Form */}
        {activeTab === 'payments' && showPaymentForm && (
          <div className="glass-card p-6">
            <h2 className="modal-title text-xl mb-4">Process Salary Payment</h2>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label htmlFor="payment_teacher" className="label-text">
                  Select Teacher <span className="text-red-600">*</span>
                </label>
                <SelectField
                  id="payment_teacher"
                  value={paymentFormData.staff_id}
                  onChange={(e) => handlePaymentTeacherChange(e.target.value)}
                  required
                  className="select-field w-full"
                >
                  <option value="">
                    {teachersForPayment.length === 0
                      ? 'No teachers with salary structure'
                      : 'Select teacher'}
                  </option>
                  {teachersForPayment.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {getTeacherLabel(teacher)}
                    </option>
                  ))}
                </SelectField>
                {teachersForPayment.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Create a salary structure first before processing payments.
                  </p>
                )}
              </div>

              {paymentFormData.staff_id && (
                <div>
                  <label htmlFor="salary_structure_id" className="label-text">
                    Salary Structure <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="salary_structure_id"
                    name="salary_structure_id"
                    value={paymentFormData.salary_structure_id}
                    onChange={handlePaymentChange}
                    required
                    className="select-field w-full"
                  >
                    <option value="" disabled hidden>
                      Select salary structure
                    </option>
                    {structures
                      ?.filter((s: any) => s.staff_id === parseInt(paymentFormData.staff_id) && s.is_active)
                      .map((structure: any) => (
                        <option key={structure.id} value={structure.id}>
                          Net: {formatMoney(structure.net_salary)} (Basic: {formatMoney(structure.basic_salary)})
                        </option>
                      ))}
                  </SelectField>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="month" className="label-text">
                    Month <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="month"
                    name="month"
                    value={paymentFormData.month}
                    onChange={handlePaymentChange}
                    required
                    className="select-field w-full"
                  >
                    <option value="" disabled hidden>
                      Select month
                    </option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {getMonthName(m)}
                      </option>
                    ))}
                  </SelectField>
                </div>

                <div>
                  <label htmlFor="year" className="label-text">
                    Year <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    id="year"
                    name="year"
                    value={paymentFormData.year}
                    onChange={handlePaymentChange}
                    required
                    min="2020"
                    max="2100"
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="payment_date" className="label-text">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    id="payment_date"
                    name="payment_date"
                    value={paymentFormData.payment_date}
                    onChange={handlePaymentChange}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="payment_mode" className="label-text">
                    Payment Mode <span className="text-red-600">*</span>
                  </label>
                  <SelectField
                    id="payment_mode"
                    name="payment_mode"
                    value={paymentFormData.payment_mode}
                    onChange={handlePaymentChange}
                    required
                    className="select-field w-full"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </SelectField>
                </div>

                {paymentFormData.payment_mode === 'Bank Transfer' && selectedStructure && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-slate-800">
                    <p className="font-semibold text-emerald-900 mb-2">Bank account (for transfer)</p>
                    {paymentBankSaved ? (
                      <dl className="space-y-1">
                        <div>
                          <dt className="inline text-slate-500">Bank: </dt>
                          <dd className="inline font-medium">{paymentFormData.payout_bank_name}</dd>
                        </div>
                        <div>
                          <dt className="inline text-slate-500">IFSC: </dt>
                          <dd className="inline font-medium">{paymentFormData.payout_ifsc_code}</dd>
                        </div>
                        <div>
                          <dt className="inline text-slate-500">Account: </dt>
                          <dd className="inline font-medium">{paymentFormData.payout_account_number}</dd>
                        </div>
                        {paymentFormData.payout_account_holder_name && (
                          <div>
                            <dt className="inline text-slate-500">Holder: </dt>
                            <dd className="inline">{paymentFormData.payout_account_holder_name}</dd>
                          </div>
                        )}
                        <p className="text-xs text-emerald-800 mt-2">From salary structure — shown on invoice.</p>
                      </dl>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-amber-800 text-xs">
                          No bank details saved. Enter below (included on invoice).
                        </p>
                        <div>
                          <label htmlFor="payout_bank_name" className="text-xs font-medium text-slate-600">
                            Bank name <span className="text-red-600">*</span>
                          </label>
                          <BankNameSearchInput
                            id="payout_bank_name"
                            value={paymentFormData.payout_bank_name}
                            onChange={(v) =>
                              setPaymentFormData((prev) => ({ ...prev, payout_bank_name: v }))
                            }
                            placeholder="Type to search bank name..."
                            className="input-field w-full mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor="payout_ifsc_code" className="text-xs font-medium text-slate-600">
                              IFSC <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              id="payout_ifsc_code"
                              name="payout_ifsc_code"
                              value={paymentFormData.payout_ifsc_code}
                              onChange={handlePaymentChange}
                              onBlur={(e) => lookupPayoutIfscBank(e.target.value)}
                              maxLength={11}
                              className="input-field w-full mt-1 text-sm uppercase"
                              placeholder="e.g. SBIN0001234"
                            />
                          </div>
                          <div>
                            <label htmlFor="payout_account_number" className="text-xs font-medium text-slate-600">
                              Account no. <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              id="payout_account_number"
                              name="payout_account_number"
                              value={paymentFormData.payout_account_number}
                              onChange={handlePaymentChange}
                              className="input-field w-full mt-1 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="payout_account_holder_name" className="text-xs font-medium text-slate-600">
                            Account holder
                          </label>
                          <input
                            type="text"
                            id="payout_account_holder_name"
                            name="payout_account_holder_name"
                            value={paymentFormData.payout_account_holder_name}
                            onChange={handlePaymentChange}
                            className="input-field w-full mt-1 text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            name="save_payout_to_structure"
                            checked={paymentFormData.save_payout_to_structure}
                            onChange={handlePaymentChange}
                            className="rounded border-slate-300"
                          />
                          Save to salary structure for future payments
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {paymentFormData.payment_mode === 'Online' && selectedStructure && (
                  <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-4 text-sm text-slate-800">
                    <p className="font-semibold text-violet-900 mb-2">UPI (PhonePe / GPay / Paytm)</p>
                    {paymentUpiSaved ? (
                      <p>
                        <span className="text-slate-500">UPI ID: </span>
                        <span className="font-medium">{paymentFormData.payout_upi_id}</span>
                        <span className="block text-xs text-violet-800 mt-2">From salary structure — shown on invoice.</span>
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-amber-800 text-xs">No UPI ID saved. Enter below (included on invoice).</p>
                        <input
                          type="text"
                          id="payout_upi_id"
                          name="payout_upi_id"
                          value={paymentFormData.payout_upi_id}
                          onChange={handlePaymentChange}
                          placeholder="name@upi or 9876543210@ybl"
                          className="input-field w-full text-sm"
                          required
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            name="save_payout_to_structure"
                            checked={paymentFormData.save_payout_to_structure}
                            onChange={handlePaymentChange}
                            className="rounded border-slate-300"
                          />
                          Save to salary structure for future payments
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="transaction_id" className="label-text">
                  {paymentFormData.payment_mode === 'Online' ? 'UPI / Transaction reference' : 'Transaction ID'}
                </label>
                <input
                  type="text"
                  id="transaction_id"
                  name="transaction_id"
                  value={paymentFormData.transaction_id}
                  onChange={handlePaymentChange}
                  placeholder={
                    paymentFormData.payment_mode === 'Online'
                      ? 'Optional UTR or payment reference'
                      : 'Optional transaction reference'
                  }
                  className="input-field"
                />
              </div>

              {/* Salary Calculation Section - Only for School Admin and Principal */}
              {canSetAdjustments && selectedStructure && paymentFormData.month && paymentFormData.year && (
                <div className="border-t border-white/20 pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-white/95 mb-4">
                    Salary Calculation & Adjustments
                  </h3>
                  
                  <div className="mb-4 p-3 bg-blue-500/20 border border-blue-400/30 rounded-lg">
                    <p className="text-sm text-blue-200 ">
                      <strong>Base Net Salary:</strong> {formatMoney(selectedStructure.net_salary || 0)}
                    </p>
                    <p className="text-xs text-blue-300 mt-1">
                      Formula: Base Net Salary - Leave Deductions - Penalties + Adjustments = Net Salary to Receive
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="leave_deduction" className="label-text">
                        Leave Deduction (₹)
                        <button
                          type="button"
                          onClick={fetchLeaveDeduction}
                          className="ml-2 text-xs text-primary-600 hover:text-primary-700 underline"
                          title="Auto-calculate from rejected leaves"
                        >
                          Auto-calculate
                        </button>
                      </label>
                      <input
                        type="number"
                        id="leave_deduction"
                        name="leave_deduction"
                        value={paymentFormData.leave_deduction}
                        onChange={handlePaymentChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-yellow-300 ">
                        Deduction for unpaid/rejected leaves
                      </p>
                    </div>

                    <div>
                      <label htmlFor="penalties" className="label-text">
                        Penalties (₹)
                      </label>
                      <input
                        type="number"
                        id="penalties"
                        name="penalties"
                        value={paymentFormData.penalties}
                        onChange={handlePaymentChange}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-yellow-300 ">
                        Fines and penalties
                      </p>
                    </div>

                    <div>
                      <label htmlFor="adjustments" className="label-text">
                        Adjustments (₹)
                      </label>
                      <input
                        type="number"
                        id="adjustments"
                        name="adjustments"
                        value={paymentFormData.adjustments}
                        onChange={handlePaymentChange}
                        step="0.01"
                        placeholder="0.00"
                        className="input-field"
                      />
                      <p className="mt-1 text-xs text-blue-300 ">
                        Positive or negative adjustments
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-green-500/20 border border-green-400/30 rounded-lg">
                    <label htmlFor="net_salary_to_receive" className="label-text">
                      Net Salary to Receive (₹) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="number"
                      id="net_salary_to_receive"
                      name="net_salary_to_receive"
                      value={paymentFormData.net_salary_to_receive}
                      readOnly
                      className="input-field font-bold text-lg cursor-not-allowed opacity-90"
                    />
                    <p className="mt-2 text-sm text-green-200 ">
                      ✓ Auto-calculated: {formatMoney(selectedStructure.net_salary || 0)} 
                      {parseFloat(paymentFormData.leave_deduction || 0) > 0 && (
                        <span className="text-red-600"> - {formatMoney(paymentFormData.leave_deduction)} (leaves)</span>
                      )}
                      {parseFloat(paymentFormData.penalties || 0) > 0 && (
                        <span className="text-red-600"> - {formatMoney(paymentFormData.penalties)} (penalties)</span>
                      )}
                      {parseFloat(paymentFormData.adjustments || 0) !== 0 && (
                        <span className={parseFloat(paymentFormData.adjustments) > 0 ? 'text-green-300' : 'text-red-600'}>
                          {parseFloat(paymentFormData.adjustments) > 0 ? ' + ' : ' - '}{formatMoney(Math.abs(parseFloat(paymentFormData.adjustments)))} (adjustments)
                        </span>
                      )}
                      {' = ' + formatMoney(paymentFormData.net_salary_to_receive || 0)}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="remarks" className="label-text">
                  Remarks
                </label>
                <textarea
                  id="remarks"
                  name="remarks"
                  value={paymentFormData.remarks}
                  onChange={handlePaymentChange}
                  rows={3}
                  placeholder="Optional remarks or notes"
                  className="input-field"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetPaymentForm}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processPaymentMutation.isLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {processPaymentMutation.isLoading ? 'Processing...' : 'Process Payment'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'structures' && !showStructureForm && (
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            <PageFilterBar>
              <PageFilterRow>
                <PageFilterSearch
                  id="structure_search"
                  value={structureSearch}
                  onChange={setStructureSearch}
                  placeholder="Search by staff name or salary amount..."
                />

                <PageFilterField id="structure_status" label="Status">
                  <SelectField
                    id="structure_status"
                    value={structureStatusFilter}
                    onChange={(e) => setStructureStatusFilter(e.target.value)}
                    className="select-field"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </SelectField>
                </PageFilterField>

                {hasStructureFilters ? (
                  <PageFilterClearButton
                    label="Clear filters"
                    onClick={() => {
                      setStructureSearch('')
                      setStructureStatusFilter('')
                    }}
                  />
                ) : null}

                <PageFilterActions>
                  <ExportMenu
                    onExport={structureExport.handleExport}
                    isExporting={structureExport.isExporting}
                    recordCount={displayStructures.length}
                    size="sm"
                  />
                </PageFilterActions>
              </PageFilterRow>

              {structureExport.exportError ? (
                <p className="mt-2 text-xs text-red-200" role="alert">
                  {structureExport.exportError}
                </p>
              ) : null}
              {hasStructureFilters ? (
                <p className="mt-3 text-sm text-white/60">
                  Showing {displayStructures.length} of {structures?.length ?? 0} salary structure
                  {(structures?.length ?? 0) === 1 ? '' : 's'}
                </p>
              ) : null}
            </PageFilterBar>

            <div className="flex-1 min-h-0 flex flex-col table-shell fees-page-table salaries-page-table overflow-hidden">
              <div className="fees-table-scroll">
                <table className="data-table fees-table salaries-table">
                  <thead className="sticky">
                    <tr>
                      <th className="salaries-col-name">Staff Name</th>
                      <th className="salaries-col-amount">Basic Salary</th>
                      <th className="salaries-col-amount">Allowances</th>
                      <th className="salaries-col-amount">Deductions</th>
                      <th className="salaries-col-amount">Net Salary</th>
                      <th className="salaries-col-date">Effective From</th>
                      <th className="salaries-col-status">Status</th>
                      <th className="fees-col-actions fees-col-actions-header salaries-col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayStructures.map((structure: any) => (
                      <tr key={structure.id} className="hover:bg-white/5 transition-colors">
                        <td className="salaries-col-name">
                          <span className="fees-cell-name" title={structure.staff_name}>
                            {structure.staff_name}
                          </span>
                        </td>
                        <td className="salaries-col-amount fees-cell-amount">
                          {formatMoney(structure.basic_salary)}
                        </td>
                        <td className="salaries-col-amount fees-cell-amount">
                          {formatMoney(structure.allowances || 0)}
                        </td>
                        <td className="salaries-col-amount fees-cell-amount">
                          {formatMoney(structure.deductions || 0)}
                        </td>
                        <td className="salaries-col-amount fees-cell-amount font-semibold text-amber-200">
                          {formatMoney(structure.net_salary)}
                        </td>
                        <td className="salaries-col-date fees-cell-amount">
                          {structure.effective_from
                            ? new Date(structure.effective_from).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="salaries-col-status">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              structure.is_active
                                ? 'badge-success'
                                : 'bg-gray-500/30 text-gray-100 border border-gray-400/30'
                            }`}
                          >
                            {structure.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="fees-col-actions salaries-col-actions">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditStructure(structure)}
                              className="p-1.5 text-blue-300 hover:bg-white/10 rounded transition-colors"
                              title="Edit salary structure"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStructure(structure)}
                              disabled={deleteStructureMutation.isLoading}
                              className="p-1.5 text-red-300 hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete salary structure"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {structures && structures.length > 0 && displayStructures.length === 0 && (
                  <div className="text-center py-12 text-white/60">
                    No salary structures match your search or filters.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStructureSearch('')
                        setStructureStatusFilter('')
                      }}
                      className="text-primary-300 hover:text-primary-200 font-medium"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                {(!structures || structures.length === 0) && (
                  <div className="text-center py-12 text-white/60">
                    No salary structures found. Create a salary structure to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && !showPaymentForm && (
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            <PageFilterBar>
              <PageFilterRow>
                <PageFilterSearch
                  id="payment_search"
                  value={paymentSearch}
                  onChange={setPaymentSearch}
                  placeholder="Search by staff, month, year, or transaction..."
                />

                <PageFilterField id="payment_month" label="Month">
                  <SelectField
                    id="payment_month"
                    value={paymentMonthFilter}
                    onChange={(e) => setPaymentMonthFilter(e.target.value)}
                    className="select-field"
                  >
                    <option value="">All Months</option>
                    {paymentMonthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </SelectField>
                </PageFilterField>

                {hasPaymentFilters ? (
                  <PageFilterClearButton
                    label="Clear filters"
                    onClick={() => {
                      setPaymentSearch('')
                      setPaymentMonthFilter('')
                    }}
                  />
                ) : null}

                <PageFilterActions>
                  <ExportMenu
                    onExport={paymentExport.handleExport}
                    isExporting={paymentExport.isExporting}
                    recordCount={displayPayments.length}
                    size="sm"
                  />
                </PageFilterActions>
              </PageFilterRow>

              {paymentExport.exportError ? (
                <p className="mt-2 text-xs text-red-200" role="alert">
                  {paymentExport.exportError}
                </p>
              ) : null}
              {hasPaymentFilters ? (
                <p className="mt-3 text-sm text-white/60">
                  Showing {displayPayments.length} of {payments?.length ?? 0} payment
                  {(payments?.length ?? 0) === 1 ? '' : 's'}
                </p>
              ) : null}
            </PageFilterBar>

            <div
              className={`flex-1 min-h-0 flex flex-col table-shell salaries-page-table salaries-payments-panel overflow-hidden${
                canSetAdjustments ? ' salaries-payments-panel--with-adj' : ''
              }`}
            >
              <div className="salaries-payments-scroll">
                <table className="data-table salaries-payments-table">
                  <thead className="sticky">
                    <tr>
                      <th className="salaries-pay-col-staff">Staff</th>
                      <th className="salaries-pay-col-period">Period</th>
                      <th className="salaries-pay-col-base">Base</th>
                      {canSetAdjustments && <th className="salaries-pay-col-adj">Adjustments</th>}
                      <th className="salaries-pay-col-net">Net Paid</th>
                      <th className="salaries-pay-col-date">Date</th>
                      <th className="salaries-pay-col-mode">Mode</th>
                      <th className="salaries-pay-col-txn">Txn ID</th>
                      <th className="salaries-pay-col-status">Status</th>
                      <th className="salaries-pay-col-action">Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPayments.map((payment: any) => (
                      <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                        <td className="salaries-pay-col-staff">
                          <span className="salaries-pay-cell-clip" title={payment.staff_name}>
                            {payment.staff_name}
                          </span>
                        </td>
                        <td className="salaries-pay-col-period salaries-pay-cell-nowrap">
                          {formatPaymentPeriod(payment.month, payment.year)}
                        </td>
                        <td className="salaries-pay-col-base salaries-pay-cell-nowrap">
                          {formatCompactAmount(payment.net_salary || 0)}
                        </td>
                        {canSetAdjustments && (
                          <td className="salaries-pay-col-adj">{renderPaymentAdjustments(payment)}</td>
                        )}
                        <td className="salaries-pay-col-net salaries-pay-cell-nowrap font-semibold text-emerald-300">
                          {formatCompactAmount(payment.net_salary_to_receive || payment.net_salary || 0)}
                        </td>
                        <td className="salaries-pay-col-date salaries-pay-cell-nowrap">
                          {payment.payment_date ? formatCompactDate(payment.payment_date) : '—'}
                        </td>
                        <td className="salaries-pay-col-mode">
                          <span className="salaries-pay-cell-clip" title={payment.payment_mode}>
                            {shortPaymentMode(payment.payment_mode)}
                          </span>
                        </td>
                        <td className="salaries-pay-col-txn">
                          <span className="salaries-pay-cell-clip" title={payment.transaction_id || undefined}>
                            {payment.transaction_id || '—'}
                          </span>
                        </td>
                        <td className="salaries-pay-col-status">
                          <span
                            className={
                              payment.status === 'Paid'
                                ? 'badge-success'
                                : payment.status === 'Pending'
                                ? 'badge-warning'
                                : 'inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200'
                            }
                          >
                            {payment.status}
                          </span>
                        </td>
                        <td className="salaries-pay-col-action">
                          {payment.status === 'Paid' ? (
                            <button
                              type="button"
                              onClick={() => openSalaryInvoice(payment.id)}
                              disabled={salaryInvoiceLoading}
                              className="inline-flex items-center justify-center p-1.5 text-primary-200 bg-primary-500/20 border border-primary-400/30 rounded-md hover:bg-primary-500/30 disabled:opacity-50"
                              title="View invoice"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-white/40">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payments && payments.length > 0 && displayPayments.length === 0 && (
                  <div className="text-center py-12 text-white/60">
                    No salary payments match your search or filters.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentSearch('')
                        setPaymentMonthFilter('')
                      }}
                      className="text-primary-300 hover:text-primary-200 font-medium"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                {(!payments || payments.length === 0) && (
                  <div className="text-center py-12 text-white/60">
                    No salary payments found. Process a payment to get started.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {salaryInvoiceLoading && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
            <div className="glass-card px-6 py-4 text-slate-700">Loading invoice…</div>
          </div>
        )}

        {salaryInvoiceData && !salaryInvoiceLoading && (
          <SalaryInvoicePrint
            data={salaryInvoiceData}
            onClose={() => setSalaryInvoiceData(null)}
          />
        )}
      </div>
    </Layout>
  )
}
