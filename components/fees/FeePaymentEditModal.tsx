'use client'


import SelectField from '@/components/SelectField'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  normalizePaymentDateForApi,
  parsePaymentDateForInput,
} from '@/lib/paymentDates'
import { formatMoney } from '@/lib/formatMoney'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const PAYMENT_MODES = ['Cash', 'Card', 'Net Banking', 'UPI'] as const
type PaymentMode = (typeof PAYMENT_MODES)[number]

function roundMoney(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100) / 100
}

interface FeePaymentEditModalProps {
  payment: {
    id: number
    amount: number | string
    total_amount?: number | string
    discount_amount?: number | string
    payment_date: string
    payment_mode: string
    transaction_id?: string | null
    remarks?: string | null
    receipt_number?: string
    first_name?: string
    last_name?: string | null
    fee_structure_name?: string
    fee_structure_id: number
    student_id: number
  }
  schoolId: number
  academicYearId: number
  token: string
  maxAmount: number
  onClose: () => void
  onSaved: (paymentId: number, updatedPayment?: Record<string, unknown>) => void | Promise<void>
}

export default function FeePaymentEditModal({
  payment,
  schoolId,
  academicYearId,
  token,
  maxAmount,
  onClose,
  onSaved,
}: FeePaymentEditModalProps) {
  const [amount, setAmount] = useState(String(parseFloat(String(payment.amount)) || ''))
  const [paymentDate, setPaymentDate] = useState(parsePaymentDateForInput(payment.payment_date))
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    PAYMENT_MODES.includes(payment.payment_mode as PaymentMode)
      ? (payment.payment_mode as PaymentMode)
      : 'Cash'
  )
  const [referenceNumber, setReferenceNumber] = useState(payment.transaction_id || '')
  const [remarks, setRemarks] = useState(payment.remarks || '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const discount = roundMoney(parseFloat(String(payment.discount_amount || 0)))
  const payAmount = roundMoney(parseFloat(amount || '0'))
  const totalToCollect = roundMoney(Math.max(0, payAmount - discount))

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'academic-year-id': String(academicYearId),
      'Content-Type': 'application/json',
    }),
    [token, academicYearId]
  )

  const needsReference = paymentMode === 'UPI' || paymentMode === 'Card' || paymentMode === 'Net Banking'
  const referenceLabel = paymentMode === 'UPI' ? 'UTR Number' : 'Transaction Number'

  useEffect(() => {
    if (!needsReference) setReferenceNumber('')
  }, [needsReference])

  const studentName = `${payment.first_name || ''} ${payment.last_name || ''}`.trim()

  useEffect(() => {
    setAmount(String(parseFloat(String(payment.amount)) || ''))
    setPaymentDate(parsePaymentDateForInput(payment.payment_date))
    setPaymentMode(
      PAYMENT_MODES.includes(payment.payment_mode as PaymentMode)
        ? (payment.payment_mode as PaymentMode)
        : 'Cash'
    )
    setReferenceNumber(payment.transaction_id || '')
    setRemarks(payment.remarks || '')
    setError('')
  }, [
    payment.id,
    payment.updated_at,
    payment.amount,
    payment.payment_date,
    payment.payment_mode,
    payment.transaction_id,
    payment.remarks,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!paymentDate) {
      setError('Payment date is required')
      return
    }
    if (!payAmount || payAmount <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (payAmount > maxAmount + 0.005) {
      setError(`Amount cannot exceed ${formatMoney(maxAmount)} (remaining fee balance)`)
      return
    }

    setSubmitting(true)
    try {
      const response = await axios.put(
        `${API_URL}/payments/${payment.id}`,
        {
          school_id: schoolId,
          academic_year_id: academicYearId,
          amount: payAmount,
          payment_date: normalizePaymentDateForApi(paymentDate),
          payment_mode: paymentMode,
          transaction_id: needsReference && referenceNumber.trim() ? referenceNumber.trim() : null,
          remarks: remarks.trim() || null,
        },
        { headers }
      )

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Update failed')
      }

      const updated = response.data?.data?.payment as Record<string, unknown> | undefined
      await Promise.resolve(onSaved(payment.id, updated))
      onClose()
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update payment'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-200 shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Edit Payment</h2>
          <p className="text-sm text-slate-500 mt-1">
            {studentName || 'Student'} · {payment.fee_structure_name || 'Fee'}
          </p>
          {payment.receipt_number && (
            <p className="text-xs font-mono text-slate-400 mt-1">Receipt: {payment.receipt_number}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="label-text">Billing Amount (₹) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="input-field"
            />
            <p className="mt-1 text-xs text-slate-500">
              Maximum allowed: {formatMoney(maxAmount)} (remaining fee balance)
            </p>
          </div>

          {discount > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
              Coupon discount on this payment: {formatMoney(discount)} · Collected: {formatMoney(totalToCollect)}
            </div>
          )}

          <div>
            <label className="label-text">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="label-text">Payment Mode *</label>
            <SelectField
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              className="select-field"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectField>
          </div>

          {needsReference && (
            <div>
              <label className="label-text">{referenceLabel} (optional)</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          <div>
            <label className="label-text">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="input-field"
              placeholder="Optional notes"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2 shrink-0">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
