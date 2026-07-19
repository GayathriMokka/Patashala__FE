'use client'


import SelectField from '@/components/SelectField'
import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { formatMoney } from '@/lib/formatMoney'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

const PAYMENT_MODES = ['Cash', 'Card', 'Net Banking', 'UPI'] as const
type PaymentMode = (typeof PAYMENT_MODES)[number]

function roundMoney(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100) / 100
}

const FIELD_LABELS: Record<string, string> = {
  student_id: 'Student',
  fee_structure_id: 'Fee structure',
  amount: 'Amount',
  payment_date: 'Payment date',
  coupon_id: 'Coupon',
}

function getApiErrorMessage(err: any, fallback: string) {
  const data = err?.response?.data
  if (data?.error) return data.error
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    const messages = data.errors.map((e: { msg?: string; path?: string; param?: string }) => {
      const field = e.path || e.param
      const label = field ? FIELD_LABELS[field] || field : ''
      const msg = e.msg || 'Invalid value'
      if (msg === 'Invalid value' && label) {
        return `${label} is missing or invalid`
      }
      return label ? `${label}: ${msg}` : msg
    })
    return [...new Set(messages)].join('. ')
  }
  return fallback
}

interface Coupon {
  id: number
  code: string
  name: string
  discount_percentage: number
}

interface FeeCollectModalProps {
  fee: {
    id: number
    name: string
    total_amount: number | string
    class_name?: string
    section_name?: string
    student_id?: number | null
    admission_number?: string
  }
  schoolId: number
  academicYearId: number
  token: string
  onClose: () => void
  onSuccess: (paymentId: number, receiptNumber: string) => void
}

export default function FeeCollectModal({
  fee,
  schoolId,
  academicYearId,
  token,
  onClose,
  onSuccess,
}: FeeCollectModalProps) {
  const [amount, setAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedCouponId, setSelectedCouponId] = useState<string>('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [amountError, setAmountError] = useState('')
  const [feeSummary, setFeeSummary] = useState({ total: 0, paid: 0, balance: 0 })

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'academic-year-id': String(academicYearId),
    }),
    [token, academicYearId]
  )

  useEffect(() => {
    const load = async () => {
      if (!fee.student_id) {
        setLoading(false)
        return
      }
      try {
        const [paymentsRes, couponsRes] = await Promise.all([
          axios.get(`${API_URL}/payments`, {
            params: {
              school_id: schoolId,
              academic_year_id: academicYearId,
              student_id: fee.student_id,
              fee_structure_id: fee.id,
            },
            headers,
          }),
          axios.get(`${API_URL}/coupons`, {
            params: { school_id: schoolId, active_only: 'true' },
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => ({ data: { data: [] } })),
        ])
        const paid = roundMoney(
          (paymentsRes.data.data || []).reduce(
            (sum: number, p: any) => sum + parseFloat(p.amount ?? p.total_amount ?? 0),
            0
          )
        )
        const total = roundMoney(parseFloat(String(fee.total_amount)))
        setFeeSummary({
          total,
          paid,
          balance: roundMoney(Math.max(0, total - paid)),
        })
        setCoupons(couponsRes.data.data || [])
      } catch {
        setFeeSummary({
          total: parseFloat(String(fee.total_amount)),
          paid: 0,
          balance: parseFloat(String(fee.total_amount)),
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [fee, schoolId, academicYearId, token, headers])

  const payAmount = roundMoney(parseFloat(amount || '0'))
  const totalToCollect = roundMoney(Math.max(0, payAmount - couponDiscount))

  const validateAmount = (value: string, balance: number, autoCap = false) => {
    if (!value.trim()) {
      setAmountError('')
      return { valid: true, normalized: '' }
    }
    let num = roundMoney(parseFloat(value))
    if (Number.isNaN(num) || num <= 0) {
      setAmountError('Enter a valid amount greater than 0')
      return { valid: false, normalized: value }
    }
    if (balance <= 0) {
      setAmountError('No pending balance left for this fee')
      return { valid: false, normalized: value }
    }
    if (num > balance + 0.005) {
      if (autoCap) {
        num = balance
        setAmount(String(num))
        setAmountError('')
        return { valid: true, normalized: String(num) }
      }
      setAmountError(`Cannot exceed pending balance of ${formatMoney(balance)}`)
      return { valid: false, normalized: value }
    }
    setAmountError('')
    return { valid: true, normalized: String(num) }
  }

  const handleAmountChange = (value: string) => {
    setAmount(value)
    setError('')
    validateAmount(value, feeSummary.balance)
    setSelectedCouponId('')
    setCouponDiscount(0)
  }

  const handleAmountBlur = () => {
    validateAmount(amount, feeSummary.balance, true)
  }

  useEffect(() => {
    if (!selectedCouponId) {
      setCouponDiscount(0)
      return
    }
    if (!payAmount || payAmount <= 0) {
      setCouponDiscount(0)
      return
    }

    const applyCoupon = async () => {
      try {
        const res = await axios.post(
          `${API_URL}/coupons/validate`,
          {
            school_id: schoolId,
            coupon_id: parseInt(selectedCouponId, 10),
            amount: payAmount,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        setCouponDiscount(res.data.data.discount_amount)
        setError('')
      } catch (err: any) {
        setCouponDiscount(0)
        setError(getApiErrorMessage(err, 'Could not apply this coupon'))
      }
    }
    applyCoupon()
  }, [selectedCouponId, payAmount, schoolId, token])

  const handleCouponChange = (value: string) => {
    setSelectedCouponId(value)
    setCouponDiscount(0)
    setError('')
  }

  const handleProofChange = (file: File | null) => {
    setProofFile(file)
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    setProofPreview(file ? URL.createObjectURL(file) : null)
  }

  const needsReference = paymentMode === 'UPI' || paymentMode === 'Card' || paymentMode === 'Net Banking'
  const referenceLabel = paymentMode === 'UPI' ? 'UTR Number' : 'Transaction Number'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fee.student_id) {
      setError('Student could not be linked to this fee structure.')
      return
    }
    const amountCheck = validateAmount(amount, feeSummary.balance, true)
    if (!amountCheck.valid) {
      if (!amount.trim()) setError('Enter the amount to bill.')
      return
    }

    const billedAmount = roundMoney(parseFloat(amountCheck.normalized || amount))
    if (billedAmount > feeSummary.balance + 0.005) {
      setError(`Billing amount cannot exceed pending balance of ${formatMoney(feeSummary.balance)}`)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        school_id: schoolId,
        academic_year_id: academicYearId,
        student_id: fee.student_id,
        fee_structure_id: fee.id,
        amount: billedAmount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        transaction_id: needsReference && referenceNumber.trim() ? referenceNumber.trim() : null,
        coupon_id: selectedCouponId ? parseInt(selectedCouponId, 10) : null,
        remarks: remarks.trim() || null,
      }

      let response
      if (proofFile) {
        const formData = new FormData()
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            formData.append(key, String(value))
          }
        })
        formData.append('payment_proof', proofFile)
        // Do not set Content-Type manually — axios adds the multipart boundary
        response = await axios.post(`${API_URL}/payments`, formData, { headers })
      } else {
        response = await axios.post(`${API_URL}/payments`, payload, { headers })
      }

      onSuccess(response.data.data.id, response.data.data.receipt_number)
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to collect payment'))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCoupon = useMemo(
    () => coupons.find((c) => String(c.id) === selectedCouponId),
    [coupons, selectedCouponId]
  )

  const payFullBalance = () => {
    if (feeSummary.balance <= 0) return
    const value = String(roundMoney(feeSummary.balance))
    setAmount(value)
    validateAmount(value, feeSummary.balance)
    setSelectedCouponId('')
    setCouponDiscount(0)
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Collect Fee</h3>
            <p className="text-sm text-slate-500">{fee.name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl text-center">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Total Fee</p>
                    <p className="text-lg font-bold text-slate-900">{formatMoney(feeSummary.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Paid</p>
                    <p className="text-lg font-bold text-emerald-600">{formatMoney(feeSummary.paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Pending</p>
                    <p className="text-lg font-bold text-amber-700">{formatMoney(feeSummary.balance)}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-text mb-0">Billing Amount (₹) *</label>
                    {feeSummary.balance > 0 && (
                      <button
                        type="button"
                        onClick={payFullBalance}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        Bill full pending
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    onBlur={handleAmountBlur}
                    placeholder="Enter amount to bill"
                    className={`input-field text-lg ${amountError ? 'border-red-500' : ''}`}
                  />
                  {amountError && <p className="mt-1 text-xs text-red-600">{amountError}</p>}
                  <p className="mt-1 text-xs text-slate-500">
                    Partial payment allowed. Pending balance: {formatMoney(feeSummary.balance)} (cannot exceed).
                  </p>
                </div>

                <div>
                  <label className="label-text">Apply Coupon (optional)</label>
                  <SelectField
                    value={selectedCouponId}
                    onChange={(e) => handleCouponChange(e.target.value)}
                    disabled={!payAmount || payAmount <= 0 || coupons.length === 0}
                    className="select-field disabled:opacity-50"
                  >
                    <option value="">No coupon</option>
                    {coupons.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.code} — {c.name} ({c.discount_percentage}% off)
                      </option>
                    ))}
                  </SelectField>
                  {coupons.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      No active coupons. Create coupons in Master Data → Coupon.
                    </p>
                  )}
                  {selectedCoupon && couponDiscount > 0 && (
                    <p className="mt-2 text-sm text-emerald-700 font-medium">
                      Coupon discount: −{formatMoney(couponDiscount)} ({selectedCoupon.discount_percentage}%)
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-primary-50 border border-primary-100">
                  <div className="flex justify-between text-sm text-primary-800 mb-1">
                    <span>Amount billed to fee</span>
                    <span>{formatMoney(payAmount > 0 ? payAmount : 0)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-700 mb-1">
                      <span>Coupon savings</span>
                      <span>−{formatMoney(couponDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-primary-900 pt-2 border-t border-primary-200">
                    <span>Total to collect</span>
                    <span>{formatMoney(totalToCollect)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
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
                    onChange={(e) => {
                      setPaymentMode(e.target.value as PaymentMode)
                      setReferenceNumber('')
                      handleProofChange(null)
                    }}
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
                  <div className="space-y-3 p-4 border border-slate-200 rounded-xl bg-slate-50/80">
                    <div>
                      <label className="label-text">{referenceLabel} (optional)</label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder={
                          paymentMode === 'UPI'
                            ? 'Enter UTR / reference number'
                            : 'Enter transaction number'
                        }
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label-text">Payment proof image (optional)</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => handleProofChange(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-white file:text-slate-700 file:font-medium"
                      />
                      {proofPreview && (
                        <img
                          src={proofPreview}
                          alt="Payment proof preview"
                          className="mt-2 h-24 rounded-lg border border-slate-200 object-cover"
                        />
                      )}
                    </div>
                  </div>
                )}

                {paymentMode === 'Cash' && (
                  <p className="text-sm text-slate-500 italic">
                    No reference or proof required for cash payments.
                  </p>
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
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 max-w-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                loading ||
                !fee.student_id ||
                !amount.trim() ||
                !!amountError ||
                payAmount <= 0 ||
                feeSummary.balance <= 0
              }
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {submitting
                ? 'Processing...'
                : totalToCollect > 0
                ? `Pay ${formatMoney(totalToCollect)}`
                : 'Pay'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
