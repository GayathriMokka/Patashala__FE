'use client'

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatAmountInWords } from '@/lib/amountInWords'
import { formatPaymentDateDisplay } from '@/lib/paymentDates'
import { formatMoney } from '@/lib/formatMoney'
import { getSchoolLogoUrl } from '@/lib/schoolBranding'

export interface InvoiceData {
  payment: {
    receipt_number: string
    payment_date: string
    amount: number | string
    fine_amount?: number | string
    discount_amount?: number | string
    total_amount: number | string
    payment_mode: string
    transaction_id?: string
    remarks?: string
    split_details?: Array<{ amount: number; payment_mode: string; transaction_id?: string }>
    first_name: string
    last_name?: string
    admission_number?: string
    class_name?: string
    section_name?: string
    roll_number?: string | null
    academic_year_name?: string
    collected_by_name?: string
    remarks?: string
    coupon_code?: string
    payment_proof_url?: string
    created_at?: string
    updated_at?: string
  }
  school: {
    name: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    phone?: string
    email?: string
    logo_url?: string
    logo_version?: number | null
    branch_name?: string | null
  } | null
  invoice_settings: {
    header_title?: string
    tagline?: string
    footer_note?: string
    terms_and_conditions?: string
    show_logo?: boolean
    show_gst?: boolean
    gst_number?: string
  }
  fee_summary?: {
    fee_structure_total: number
    total_paid: number
    balance: number
  }
}

interface FeeInvoicePrintProps {
  data: InvoiceData
  onClose?: () => void
  showActions?: boolean
}

function formatAddress(school: InvoiceData['school']) {
  if (!school) return ''
  return [school.address, school.city, school.state, school.pincode]
    .filter(Boolean)
    .join(', ')
}

const paperSurfaceStyle = { backgroundColor: '#ffffff', color: '#0f172a' } as const

export default function FeeInvoicePrint({ data, onClose, showActions = true }: FeeInvoicePrintProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  const { payment, school, invoice_settings: settings } = data
  const headerTitle = settings.header_title || school?.name || 'School'
  const logoSrc = getSchoolLogoUrl(school?.logo_url, school?.logo_version)
  const showLogo = !!settings.show_logo
  const showGst = !!settings.show_gst
  const splits = payment.split_details
  const amountInWords = formatAmountInWords(payment.total_amount)
  const wasUpdated =
    payment.updated_at &&
    payment.created_at &&
    new Date(payment.updated_at).getTime() - new Date(payment.created_at).getTime() > 60000

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Invoice ${payment.receipt_number}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; max-width: 720px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f8fafc; }
          .header { display: flex; align-items: flex-start; gap: 16px; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 16px; }
          .header img { height: 64px; width: 64px; object-fit: contain; flex-shrink: 0; }
          .header-text { flex: 1; min-width: 0; }
          .student-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
          .total { font-size: 1.25rem; font-weight: bold; text-align: right; margin-top: 12px; }
          .muted { color: #64748b; font-size: 0.875rem; }
        </style>
      </head><body>${content.innerHTML}</body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  const modal = (
    <div
      className="invoice-paper-modal fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-invoice-title"
      onClick={onClose}
    >
      <div
        className="invoice-paper-panel rounded-xl shadow-2xl w-full max-w-2xl max-h-[min(92vh,900px)] flex flex-col overflow-hidden"
        style={paperSurfaceStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {showActions && (
          <div
            className="invoice-paper-toolbar shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 print:hidden"
            style={paperSurfaceStyle}
          >
            <h3 id="fee-invoice-title" className="text-lg font-semibold text-slate-900 truncate">
              Fee Invoice
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={handlePrint} className="btn-primary text-sm whitespace-nowrap">
                Print
              </button>
              {onClose && (
                <button type="button" onClick={onClose} className="btn-secondary text-sm whitespace-nowrap">
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        <div className="invoice-paper-scroll flex-1 overflow-y-auto min-h-0 overscroll-contain" style={paperSurfaceStyle}>
          <div
            ref={printRef}
            className="invoice-paper-content p-6 sm:p-8 text-slate-900"
            style={paperSurfaceStyle}
          >
          <div className="header flex items-start gap-4 border-b-2 border-primary-600 pb-4 mb-6">
            {showLogo && logoSrc && (
              <img src={logoSrc} alt="" className="h-16 w-16 shrink-0 object-contain" />
            )}
            <div className="header-text flex-1 min-w-0 text-left">
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">{headerTitle}</h1>
              {formatAddress(school) && (
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{formatAddress(school)}</p>
              )}
              {showGst && settings.gst_number && (
                <p className="text-xs font-medium text-slate-600 mt-1">GSTIN: {settings.gst_number}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p className="text-slate-500">Invoice / Receipt No.</p>
              <p className="font-mono font-semibold">{payment.receipt_number}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-500">Payment Date</p>
              <p className="font-medium">{formatPaymentDateDisplay(payment.payment_date)}</p>
              {wasUpdated && payment.updated_at && (
                <p className="text-xs text-amber-700 mt-1">
                  Revised {formatPaymentDateDisplay(payment.updated_at)}
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm">
            <p className="font-semibold text-slate-800 mb-3">Student Details</p>
            <div className="student-grid grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {payment.first_name} {payment.last_name || ''}
                </p>
              </div>
              {payment.admission_number && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Admission No</p>
                  <p className="font-medium text-slate-900 mt-0.5 font-mono">{payment.admission_number}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Class / Section</p>
                <p className="font-medium text-slate-900 mt-0.5">
                  {payment.class_name || '—'}
                  {payment.section_name ? ` / ${payment.section_name}` : ''}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Roll No</p>
                <p className="font-medium text-slate-900 mt-0.5">{payment.roll_number || '—'}</p>
              </div>
              {payment.academic_year_name && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Academic Year</p>
                  <p className="font-medium text-slate-900 mt-0.5">{payment.academic_year_name}</p>
                </div>
              )}
            </div>
          </div>

          <table className="w-full text-sm border border-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="border border-slate-200 px-3 py-2 text-left">Description</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 px-3 py-2">Fee payment</td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  {formatMoney(payment.amount, { symbol: false })}
                </td>
              </tr>
              {parseFloat(String(payment.discount_amount || 0)) > 0 && (
                <tr>
                  <td className="border border-slate-200 px-3 py-2">
                    Coupon discount
                    {(payment as any).coupon_code
                      ? ` (${(payment as any).coupon_code})`
                      : ''}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right text-red-600">
                    -{formatMoney(payment.discount_amount, { symbol: false })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {splits && Array.isArray(splits) && splits.length > 1 && (
            <div className="mt-4 text-sm">
              <p className="font-medium text-slate-700 mb-2">Split Payment</p>
              <table className="w-full border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="border border-slate-200 px-2 py-1">Mode</th>
                    <th className="border border-slate-200 px-2 py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s, i) => (
                    <tr key={i}>
                      <td className="border border-slate-200 px-2 py-1">{s.payment_mode}</td>
                      <td className="border border-slate-200 px-2 py-1 text-right">
                        {formatMoney(s.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="total text-right text-xl font-bold text-primary-700 mt-4">
            Total Paid: {formatMoney(payment.total_amount)}
          </p>

          {amountInWords && (
            <p className="text-sm text-slate-700 mt-2 text-right italic">
              <span className="not-italic text-slate-500">Amount in words: </span>
              {amountInWords}
            </p>
          )}

          <p className="text-sm text-slate-600 mt-2 text-right">
            Mode: {payment.payment_mode}
            {payment.transaction_id
              ? ` · ${payment.payment_mode === 'UPI' ? 'UTR' : 'Txn'}: ${payment.transaction_id}`
              : ''}
          </p>
          {payment.remarks && (
            <p className="text-sm text-slate-600 mt-2">
              <span className="text-slate-500">Remarks: </span>
              {payment.remarks}
            </p>
          )}
          {(payment as any).payment_proof_url && (
            <p className="text-xs text-slate-500 mt-1 text-right">
              Payment proof attached
            </p>
          )}

          {payment.collected_by_name && (
            <p className="text-xs text-slate-500 mt-4">Collected by: {payment.collected_by_name}</p>
          )}

          {settings.footer_note && (
            <p className="text-center text-sm text-slate-600 mt-8 border-t pt-4">{settings.footer_note}</p>
          )}
          </div>
        </div>

      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
