'use client'


import SelectField from '@/components/SelectField'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from 'react-query'
import axios from 'axios'
import FeePaymentEditModal from './FeePaymentEditModal'
import {
  patchPaymentInHistoryCache,
  refreshFinanceData,
} from '@/lib/invalidateFinanceQueries'
import { formatPaymentDateDisplay } from '@/lib/paymentDates'
import { formatMoney } from '@/lib/formatMoney'
import {
  PageFilterBar,
  PageFilterClearButton,
  PageFilterField,
  PageFilterRow,
  PageFilterSearch,
} from '@/components/PageFilters'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

function studentLabel(row: {
  first_name?: string
  last_name?: string | null
  admission_number?: string | null
}) {
  const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—'
  return row.admission_number ? `${name} (${row.admission_number})` : name
}

function roundMoney(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100) / 100
}

function getMaxEditAmount(payment: any, allPayments: any[]) {
  const feeTotal = parseFloat(payment.fee_structure_total || 0)
  if (!feeTotal) return parseFloat(payment.amount || 0)

  const paidOthers = (allPayments || [])
    .filter(
      (p) =>
        p.id !== payment.id &&
        p.status === 'Completed' &&
        Number(p.fee_structure_id) === Number(payment.fee_structure_id) &&
        Number(p.student_id) === Number(payment.student_id)
    )
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  return roundMoney(Math.max(parseFloat(payment.amount || 0), feeTotal - paidOthers))
}

interface FeePaymentHistoryProps {
  schoolId: number
  academicYearId: number
  token: string
  branchScopeKey?: string
  classes?: Array<{ id: number; name: string }>
  canManagePayments?: boolean
  onPrintInvoice: (paymentId: number) => void | Promise<void>
  onPaymentsChanged?: () => void
}

export default function FeePaymentHistory({
  schoolId,
  academicYearId,
  token,
  branchScopeKey = 'none',
  classes,
  canManagePayments = false,
  onPrintInvoice,
  onPaymentsChanged,
}: FeePaymentHistoryProps) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterClassId, setFilterClassId] = useState('')
  const [filterSectionId, setFilterSectionId] = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [editingPayment, setEditingPayment] = useState<any>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'academic-year-id': String(academicYearId),
    }),
    [token, academicYearId]
  )

  const { data: filterSections } = useQuery(
    ['sections', 'payment-history', filterClassId, academicYearId],
    async () => {
      if (!filterClassId) return []
      const response = await axios.get(`${API_URL}/sections`, {
        params: {
          class_id: filterClassId,
          school_id: schoolId,
          academic_year_id: academicYearId,
        },
        headers,
      })
      return response.data.data
    },
    { enabled: !!filterClassId }
  )

  const { data: payments, isLoading, isError } = useQuery(
    ['payments-history', schoolId, academicYearId, branchScopeKey, filterClassId, filterSectionId],
    async () => {
      const params: Record<string, string | number> = {
        school_id: schoolId,
        academic_year_id: academicYearId,
      }
      if (filterClassId) params.class_id = filterClassId
      if (filterSectionId) params.section_id = filterSectionId

      const response = await axios.get(`${API_URL}/payments`, { params, headers })
      return response.data.data as any[]
    },
    { enabled: !!schoolId && !!academicYearId && !!token, staleTime: 0 }
  )

  const refreshAll = async () => {
    await refreshFinanceData(queryClient, schoolId, academicYearId)
    onPaymentsChanged?.()
  }

  const fetchPaymentForEdit = async (paymentId: number) => {
    setEditLoading(true)
    try {
      const response = await axios.get(`${API_URL}/payments/${paymentId}`, {
        params: { school_id: schoolId, academic_year_id: academicYearId, _t: Date.now() },
        headers: { ...headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      })
      setEditingPayment(response.data.data)
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to load payment for editing')
    } finally {
      setEditLoading(false)
    }
  }

  const openEditPayment = (row: { id: number }) => {
    fetchPaymentForEdit(row.id)
  }

  const handlePrintPayment = async (paymentId: number) => {
    await refreshFinanceData(queryClient, schoolId, academicYearId)
    await Promise.resolve(onPrintInvoice(paymentId))
  }

  const handleDelete = async (payment: any) => {
    const label = payment.receipt_number || `#${payment.id}`
    const student = studentLabel(payment)
    if (
      !confirm(
        `Delete payment ${label} for ${student}?\n\nThis will restore ${formatMoney(payment.amount || 0)} to the student's pending fee balance. This cannot be undone.`
      )
    ) {
      return
    }

    setDeletingId(payment.id)
    try {
      await axios.delete(`${API_URL}/payments/${payment.id}`, {
        params: { school_id: schoolId, academic_year_id: academicYearId },
        headers,
      })
      await refreshAll()
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete payment')
    } finally {
      setDeletingId(null)
    }
  }

  const filteredPayments = useMemo(() => {
    const list = payments || []
    const q = searchTerm.trim().toLowerCase()
    return list.filter((p) => {
      if (filterMode && p.payment_mode !== filterMode) return false
      if (!q) return true
      const student = studentLabel(p).toLowerCase()
      return (
        student.includes(q) ||
        p.receipt_number?.toLowerCase().includes(q) ||
        p.fee_structure_name?.toLowerCase().includes(q) ||
        p.payment_mode?.toLowerCase().includes(q) ||
        p.class_name?.toLowerCase().includes(q) ||
        p.section_name?.toLowerCase().includes(q) ||
        String(p.amount ?? '').includes(q) ||
        String(p.total_amount ?? '').includes(q)
      )
    })
  }, [payments, searchTerm, filterMode])

  const hasActiveFilters = !!(searchTerm || filterClassId || filterSectionId || filterMode)

  const totalCollected = useMemo(
    () =>
      roundMoney(
        filteredPayments.reduce((sum, p) => sum + parseFloat(p.total_amount ?? p.amount ?? 0), 0)
      ),
    [filteredPayments]
  )

  const clearFilters = () => {
    setSearchTerm('')
    setFilterClassId('')
    setFilterSectionId('')
    setFilterMode('')
  }

  return (
    <div className="fees-payment-history">
      {editLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg px-5 py-3 text-sm text-slate-600 shadow-lg">
            Loading payment…
          </div>
        </div>
      )}

      {editingPayment && !editLoading && (
        <FeePaymentEditModal
          key={`edit-${editingPayment.id}-${editingPayment.updated_at || ''}-${editingPayment.payment_date}-${editingPayment.amount}`}
          payment={editingPayment}
          schoolId={schoolId}
          academicYearId={academicYearId}
          token={token}
          maxAmount={getMaxEditAmount(editingPayment, payments || [])}
          onClose={() => setEditingPayment(null)}
          onSaved={async (_paymentId, updatedPayment) => {
            setEditingPayment(null)
            if (updatedPayment) {
              patchPaymentInHistoryCache(queryClient, schoolId, academicYearId, updatedPayment)
            }
            await refreshFinanceData(queryClient, schoolId, academicYearId)
            onPaymentsChanged?.()
          }}
        />
      )}

      <PageFilterBar className="fees-page-filters">
        <PageFilterRow className="gap-2 lg:gap-2.5 flex-wrap">
          <PageFilterSearch
            id="history_search"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Student, receipt, amount..."
          />

          <PageFilterField id="history_class" label="Class" width="narrow">
            <SelectField
              id="history_class"
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value)
                setFilterSectionId('')
              }}
              className="select-field"
            >
              <option value="">All Classes</option>
              {classes?.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterField id="history_section" label="Section" width="narrow">
            <SelectField
              id="history_section"
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              disabled={!filterClassId}
              className="select-field disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {filterClassId ? 'All Sections' : 'Select class first'}
              </option>
              {filterSections?.map((section: { id: number; name: string }) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterField id="history_mode" label="Payment mode" width="default">
            <SelectField
              id="history_mode"
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="select-field"
            >
              <option value="">All modes</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Net Banking">Net Banking</option>
              <option value="UPI">UPI</option>
            </SelectField>
          </PageFilterField>

          {hasActiveFilters ? (
            <PageFilterClearButton label="Clear filters" onClick={clearFilters} />
          ) : null}
        </PageFilterRow>
      </PageFilterBar>

      <div className="flex-1 min-h-0 flex flex-col table-shell fees-page-table overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-white/60">Loading payment history...</div>
        ) : isError ? (
          <div className="text-center py-12 text-red-300">Failed to load payment history.</div>
        ) : (
          <>
            <div className="fees-table-scroll">
              <table className="data-table fees-history-table">
                <colgroup>
                  <col className="fees-history-col-date" />
                  <col className="fees-history-col-receipt" />
                  <col className="fees-history-col-student" />
                  <col className="fees-history-col-class" />
                  <col className="fees-history-col-section" />
                  <col className="fees-history-col-collected" />
                  <col className="fees-history-col-mode" />
                  <col className="fees-history-col-status" />
                  <col className="fees-history-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="fees-history-col-date">Date</th>
                    <th className="fees-history-col-receipt">Receipt</th>
                    <th className="fees-history-col-student">Student</th>
                    <th className="fees-history-col-class">Class</th>
                    <th className="fees-history-col-section text-center">Section</th>
                    <th className="fees-history-col-collected text-right">Collected</th>
                    <th className="fees-history-col-mode">Mode</th>
                    <th className="fees-history-col-status">Status</th>
                    <th className="fees-history-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    const discount = parseFloat(payment.discount_amount || 0)
                    const isDeleting = deletingId === payment.id
                    return (
                      <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                        <td className="fees-history-col-date fees-history-cell-amount">
                          {formatPaymentDateDisplay(payment.payment_date)}
                        </td>
                        <td className="fees-history-col-receipt fees-history-cell-amount font-mono">
                          <span className="fees-history-cell-text" title={payment.receipt_number || undefined}>
                            {payment.receipt_number || '—'}
                          </span>
                        </td>
                        <td className="fees-history-col-student">
                          <div className="fees-history-student-cell min-w-0">
                            <span
                              className="fees-history-cell-text font-medium"
                              title={`${payment.first_name || ''} ${payment.last_name || ''}`.trim()}
                            >
                              {`${payment.first_name || ''} ${payment.last_name || ''}`.trim() || '—'}
                            </span>
                            {payment.admission_number && (
                              <span
                                className="fees-history-cell-text text-xs text-white/55 font-mono"
                                title={payment.admission_number}
                              >
                                {payment.admission_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="fees-history-col-class">
                          <span className="fees-history-cell-text" title={payment.class_name || undefined}>
                            {payment.class_name || '—'}
                          </span>
                        </td>
                        <td className="fees-history-col-section fees-history-cell-amount text-center">
                          {payment.section_name || '—'}
                        </td>
                        <td className="fees-history-col-collected fees-history-cell-amount font-medium text-right">
                          {formatMoney(payment.total_amount || payment.amount || 0)}
                          {discount > 0 && (
                            <span className="block text-xs font-normal text-emerald-300">
                              −{formatMoney(discount)} disc.
                            </span>
                          )}
                        </td>
                        <td className="fees-history-col-mode fees-history-cell-amount">
                          {payment.payment_mode || '—'}
                        </td>
                        <td className="fees-history-col-status">
                          <span
                            className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                              payment.status === 'Completed'
                                ? 'badge-success'
                                : payment.status === 'Pending'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {payment.status || '—'}
                          </span>
                        </td>
                        <td className="fees-history-col-actions">
                          <div className="fees-history-actions">
                            <button
                              type="button"
                              onClick={() => handlePrintPayment(payment.id)}
                              className="btn-print"
                              title="Print invoice / receipt"
                            >
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                />
                              </svg>
                              Print
                            </button>
                            {canManagePayments && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditPayment(payment)}
                                  disabled={isDeleting}
                                  className="btn-icon btn-icon-edit disabled:opacity-50"
                                  title="Edit payment"
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
                                  onClick={() => handleDelete(payment)}
                                  disabled={isDeleting}
                                  className="btn-icon btn-icon-delete disabled:opacity-50"
                                  title="Delete payment"
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
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filteredPayments.length > 0 ? (
                  <tfoot>
                    <tr className="fees-table-totals-row">
                      <td colSpan={5} className="fees-history-col-date text-left font-semibold text-white/90">
                        <span className="fees-table-totals-label">
                          <span>Total</span>
                          <span className="fees-table-totals-count">
                            {filteredPayments.length}{' '}
                            {hasActiveFilters ? 'matching ' : ''}
                            payment{filteredPayments.length === 1 ? '' : 's'}
                          </span>
                        </span>
                      </td>
                      <td className="fees-history-col-collected fees-history-cell-amount font-semibold text-right text-emerald-300">
                        <span className="block text-xs font-normal text-white/55">Total collected</span>
                        {formatMoney(totalCollected)}
                      </td>
                      <td className="fees-history-col-mode" />
                      <td className="fees-history-col-status" />
                      <td className="fees-history-col-actions fees-col-actions-footer" />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>

            {payments && payments.length > 0 && filteredPayments.length === 0 && (
              <div className="text-center py-12 text-white/60 shrink-0">
                No payments match your search or filters.{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-primary-300 hover:text-primary-200 font-medium"
                >
                  Clear filters
                </button>
              </div>
            )}

            {(!payments || payments.length === 0) && (
              <div className="text-center py-12 text-white/60 shrink-0">
                No payments recorded yet for this academic year. Use <strong>Collect</strong> on a fee
                structure to record a payment.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
