'use client'

import SelectField from '@/components/SelectField'
import AppModal from '@/components/AppModal'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { getApiUrl } from '@/lib/api'
import { PAYMENT_MODES, type TransportAssignment, type TransportPaymentMode } from '@/lib/transportTypes'
import { formatMoney } from '@/lib/formatMoney'

type Props = {
  assignment: TransportAssignment | null
  open: boolean
  onClose: () => void
  headers: Record<string, string>
  onSuccess: (receiptNumber: string) => void
}

export default function TransportPaymentModal({ assignment, open, onClose, headers, onSuccess }: Props) {
  const [amount, setAmount] = useState('')
  const [discount, setDiscount] = useState('0')
  const [lateFee, setLateFee] = useState('0')
  const [paymentMode, setPaymentMode] = useState<TransportPaymentMode>('Cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [previousPayments, setPreviousPayments] = useState<any[]>([])

  const API_URL = getApiUrl()
  const feeAmount = assignment ? Number(assignment.fee_amount || 0) : 0
  const paidAmount = assignment
    ? Math.min(Number(assignment.paid_amount || 0), feeAmount)
    : 0
  const outstanding = assignment ? Math.max(0, feeAmount - paidAmount) : 0
  const isFullyPaid = outstanding <= 0
  const finalAmount = Math.max(
    0,
    (parseFloat(amount) || 0) - (parseFloat(discount) || 0) + (parseFloat(lateFee) || 0)
  )

  useEffect(() => {
    if (!open || !assignment) return
    setAmount(String(outstanding))
    setDiscount('0')
    setLateFee('0')
    setError('')
    axios
      .get(`${API_URL}/transport/payments`, {
        headers,
        params: { q: assignment.admission_number || assignment.student_name },
      })
      .then((res) => {
        const related = (res.data.data || []).filter(
          (p: any) => p.assignment_id === assignment.id
        )
        setPreviousPayments(related)
      })
      .catch(() => setPreviousPayments([]))
  }, [open, assignment, headers, API_URL, outstanding])

  if (!assignment) return null

  const handleSubmit = async () => {
    setError('')
    if (isFullyPaid) {
      setError('Transport fee is already fully paid')
      return
    }
    if (!amount || finalAmount <= 0) {
      setError('Enter a valid payment amount')
      return
    }
    if (finalAmount > outstanding + 0.01) {
      setError(`Amount cannot exceed outstanding balance of ${formatMoney(outstanding)}`)
      return
    }

    setSubmitting(true)
    try {
      const res = await axios.post(
        `${API_URL}/transport/payments`,
        {
          assignment_id: assignment.id,
          amount: parseFloat(amount),
          discount: parseFloat(discount) || 0,
          late_fee: parseFloat(lateFee) || 0,
          payment_mode: paymentMode,
          payment_date: paymentDate,
          reference_number: referenceNumber || null,
          remarks: remarks || null,
        },
        { headers }
      )
      onSuccess(res.data.data.receipt_number)
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Payment failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppModal open={open} onClose={onClose} panelClassName="max-w-3xl" labelledBy="transport-payment-modal-title">
      <div className="app-modal-header">
        <div>
          <h2 id="transport-payment-modal-title" className="modal-title">Collect Transport Fee</h2>
          <p className="meta-text mt-1">{assignment.student_name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="app-modal-body space-y-4">
        {error && (
          <div className="rounded-lg border border-red-400/30 bg-red-950/40 text-red-100 text-sm px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-white/15 bg-black/35 p-3 space-y-1 text-white/85">
            <p className="font-medium text-white">Student Information</p>
            <p>{assignment.student_name} ({assignment.admission_number || '—'})</p>
            <p>{assignment.class_name} – {assignment.section_name}</p>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/35 p-3 space-y-1 text-white/85">
            <p className="font-medium text-white">Transport Information</p>
            <p>Route: {assignment.route_name}</p>
            <p>Trip: {assignment.trip_selection || '—'} · Vehicle: {assignment.vehicle_number || '—'}</p>
          </div>
          <div className="rounded-lg border border-white/15 bg-black/35 p-3 space-y-1 text-white/85">
            <p className="font-medium text-white">Fee Structure</p>
            <p>{assignment.fee_type || '—'} · {formatMoney(feeAmount)}</p>
            <p>Paid: {formatMoney(paidAmount)}</p>
            <p className="font-semibold text-rose-300">
              Outstanding: {formatMoney(outstanding)}
            </p>
            {isFullyPaid && (
              <p className="text-emerald-300 text-xs font-medium">Fee fully settled — no further collection allowed.</p>
            )}
          </div>
          {previousPayments.length > 0 && (
            <div className="rounded-lg border border-white/15 bg-black/35 p-3 text-white/85">
              <p className="font-medium text-white mb-1">Previous Payments</p>
              <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                {previousPayments.map((p) => (
                  <li key={p.id}>
                    {p.receipt_number} · {formatMoney(p.final_amount)} · {p.payment_date}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label-text">Amount (₹)</label>
            <input
              type="number"
              className="input-field"
              value={amount}
              min={0}
              max={outstanding}
              step="0.01"
              disabled={isFullyPaid}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label-text">Discount (₹)</label>
            <input
              type="number"
              className="input-field"
              value={discount}
              min={0}
              disabled={isFullyPaid}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div>
            <label className="label-text">Late Fee (₹)</label>
            <input
              type="number"
              className="input-field"
              value={lateFee}
              min={0}
              disabled={isFullyPaid}
              onChange={(e) => setLateFee(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 text-emerald-100 px-4 py-2 font-semibold">
          Final Amount: {formatMoney(finalAmount)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label-text">Payment Mode</label>
            <SelectField value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as TransportPaymentMode)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label className="label-text">Reference Number</label>
            <input type="text" className="input-field" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Payment Date</label>
            <input type="date" className="input-field" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label-text">Remarks</label>
          <input type="text" className="input-field" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>

      <div className="app-modal-footer">
        <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
        <button type="button" onClick={handleSubmit} disabled={submitting || isFullyPaid} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
          {submitting ? 'Collecting…' : isFullyPaid ? 'Fee Fully Paid' : 'Collect Payment'}
        </button>
      </div>
    </AppModal>
  )
}
