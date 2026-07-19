'use client'

import SelectField from '@/components/SelectField'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  normalizePaymentDateForApi,
  parsePaymentDateForInput,
} from '@/lib/paymentDates'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const PAYMENT_MODES = ['Cash', 'Card', 'Net Banking', 'UPI'] as const
type PaymentMode = (typeof PAYMENT_MODES)[number]

interface ExPaymentSource {
  id: number
  name: string
}

interface ExPaymentEditModalProps {
  payment: {
    id: number
    source_id: number
    amount: number | string
    payment_date: string
    payment_mode: string
    transaction_id?: string | null
    payer_name: string
    payer_mobile?: string | null
    remarks?: string | null
    generate_invoice?: boolean
    receipt_number?: string
    source_name?: string
  }
  sources: ExPaymentSource[]
  schoolId: number
  academicYearId: number
  token: string
  headers?: Record<string, string>
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export default function ExPaymentEditModal({
  payment,
  sources,
  schoolId,
  academicYearId,
  token,
  headers: headersProp,
  onClose,
  onSaved,
}: ExPaymentEditModalProps) {
  const [sourceId, setSourceId] = useState(String(payment.source_id))
  const [amount, setAmount] = useState(String(parseFloat(String(payment.amount)) || ''))
  const [paymentDate, setPaymentDate] = useState(parsePaymentDateForInput(payment.payment_date))
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    PAYMENT_MODES.includes(payment.payment_mode as PaymentMode)
      ? (payment.payment_mode as PaymentMode)
      : 'Cash'
  )
  const [transactionId, setTransactionId] = useState(payment.transaction_id || '')
  const [payerName, setPayerName] = useState(payment.payer_name || '')
  const [payerMobile, setPayerMobile] = useState(payment.payer_mobile || '')
  const [remarks, setRemarks] = useState(payment.remarks || '')
  const [generateInvoice, setGenerateInvoice] = useState(!!payment.generate_invoice)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const headers = useMemo(
    () => ({
      ...headersProp,
      Authorization: headersProp?.Authorization || `Bearer ${token}`,
      'academic-year-id': headersProp?.['academic-year-id'] || String(academicYearId),
      'Content-Type': 'application/json',
    }),
    [token, academicYearId, headersProp]
  )

  const needsReference = paymentMode !== 'Cash'

  useEffect(() => {
    setSourceId(String(payment.source_id))
    setAmount(String(parseFloat(String(payment.amount)) || ''))
    setPaymentDate(parsePaymentDateForInput(payment.payment_date))
    setPaymentMode(
      PAYMENT_MODES.includes(payment.payment_mode as PaymentMode)
        ? (payment.payment_mode as PaymentMode)
        : 'Cash'
    )
    setTransactionId(payment.transaction_id || '')
    setPayerName(payment.payer_name || '')
    setPayerMobile(payment.payer_mobile || '')
    setRemarks(payment.remarks || '')
    setGenerateInvoice(!!payment.generate_invoice)
    setError('')
  }, [payment])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const payAmount = parseFloat(amount)
    if (!sourceId) {
      setError('Please select a payment source')
      return
    }
    if (!payerName.trim()) {
      setError('Payer name is required')
      return
    }
    if (!paymentDate) {
      setError('Payment date is required')
      return
    }
    if (!payAmount || Number.isNaN(payAmount) || payAmount <= 0) {
      setError('Enter a valid amount greater than 0')
      return
    }
    if (needsReference && !transactionId.trim()) {
      setError('Transaction / UTR reference is required for non-cash payments')
      return
    }

    setSubmitting(true)
    try {
      const response = await axios.put(
        `${API_URL}/ex-payments/${payment.id}`,
        {
          school_id: schoolId,
          academic_year_id: academicYearId,
          source_id: parseInt(sourceId, 10),
          amount: payAmount,
          payment_date: normalizePaymentDateForApi(paymentDate),
          payment_mode: paymentMode,
          transaction_id: needsReference && transactionId.trim() ? transactionId.trim() : null,
          payer_name: payerName.trim(),
          payer_mobile: payerMobile.trim() || null,
          remarks: remarks.trim() || null,
          generate_invoice: generateInvoice,
        },
        { headers }
      )

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Update failed')
      }

      await Promise.resolve(onSaved())
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
      setError(
        axiosErr?.response?.data?.error ||
          axiosErr?.message ||
          'Failed to update payment'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-200 shrink-0">
          <h2 className="text-xl font-bold text-slate-900">Edit Collection</h2>
          {payment.receipt_number && (
            <p className="text-xs font-mono text-slate-400 mt-1">Receipt: {payment.receipt_number}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="label-text">Payment Source *</label>
            <SelectField
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="select-field w-full"
              required
            >
              <option value="">Select source</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div>
            <label className="label-text">Payer Name *</label>
            <input
              type="text"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="label-text">Mobile Number</label>
            <input
              type="tel"
              value={payerMobile}
              onChange={(e) => setPayerMobile(e.target.value)}
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="input-field"
              />
            </div>
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
          </div>

          <div>
            <label className="label-text">Payment Mode *</label>
            <SelectField
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              className="select-field w-full"
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </SelectField>
          </div>

          {needsReference && (
            <div>
              <label className="label-text">
                {paymentMode === 'UPI' ? 'UTR / Reference No.' : 'Transaction ID'} *
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="input-field"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={generateInvoice}
              onChange={(e) => setGenerateInvoice(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Generate invoice for this payment</span>
          </label>

          {generateInvoice && (
            <div>
              <label className="label-text">Invoice Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="input-field resize-y"
              />
            </div>
          )}

          {error && <div className="alert-error text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
