'use client'

import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSchoolLogoUrl } from '@/lib/schoolBranding'
import { formatMoney } from '@/lib/formatMoney'

export interface SalaryInvoiceData {
  payment: {
    id: number
    invoice_number: string
    staff_name: string
    staff_email?: string
    employee_id?: string
    period_label: string
    month: number
    year: number
    basic_salary: number | string
    allowances: number | string
    deductions: number | string
    net_salary: number | string
    leave_deduction?: number | string
    penalties?: number | string
    adjustments?: number | string
    net_salary_to_receive: number | string
    payment_date?: string
    payment_mode?: string
    transaction_id?: string
    remarks?: string
    status: string
    academic_year_name?: string
    processed_by_name?: string
    bank_name?: string
    ifsc_code?: string
    account_number?: string
    account_holder_name?: string
    upi_id?: string
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
}

interface SalaryInvoicePrintProps {
  data: SalaryInvoiceData
  onClose?: () => void
  showActions?: boolean
}

function formatAddress(school: SalaryInvoiceData['school']) {
  if (!school) return ''
  return [school.address, school.city, school.state, school.pincode].filter(Boolean).join(', ')
}

function money(val: number | string | undefined) {
  return formatMoney(val, { symbol: false })
}

const paperSurfaceStyle = { backgroundColor: '#ffffff', color: '#0f172a' } as const

export default function SalaryInvoicePrint({ data, onClose, showActions = true }: SalaryInvoicePrintProps) {
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

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Salary ${payment.invoice_number}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; max-width: 720px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f8fafc; }
          .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 16px; }
          .total { font-size: 1.25rem; font-weight: bold; text-align: right; margin-top: 12px; color: #047857; }
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
            <h3 className="text-lg font-semibold text-slate-900">Salary Payment Invoice</h3>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={handlePrint} className="btn-primary text-sm">
                Print
              </button>
              {onClose && (
                <button type="button" onClick={onClose} className="btn-secondary text-sm">
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        <div className="invoice-paper-scroll flex-1 overflow-y-auto min-h-0" style={paperSurfaceStyle}>
          <div
            ref={printRef}
            className="invoice-paper-content p-6 sm:p-8 text-slate-900"
            style={paperSurfaceStyle}
          >
            <div className="text-center border-b-2 border-emerald-600 pb-4 mb-6">
              {showLogo && logoSrc && (
                <img src={logoSrc} alt="" className="h-14 mx-auto mb-2 object-contain" />
              )}
              <h1 className="text-2xl font-bold">{headerTitle}</h1>
              {school?.branch_name && (
                <p className="text-sm font-medium text-slate-700 mt-1">{school.branch_name}</p>
              )}
              {settings.tagline && <p className="text-sm text-slate-600 mt-1">{settings.tagline}</p>}
              <p className="text-xs text-slate-500 mt-2">{formatAddress(school)}</p>
              {(school?.phone || school?.email) && (
                <p className="text-xs text-slate-500">
                  {[school?.phone, school?.email].filter(Boolean).join(' · ')}
                </p>
              )}
              {showGst && settings.gst_number && (
                <p className="text-xs font-medium mt-1">GSTIN: {settings.gst_number}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <p className="text-slate-500">Invoice No.</p>
                <p className="font-mono font-semibold">{payment.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">Payment Date</p>
                <p className="font-medium">
                  {payment.payment_date
                    ? new Date(payment.payment_date).toLocaleDateString()
                    : '—'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-sm">
              <p className="font-semibold text-slate-800 mb-2">Employee Details</p>
              <p>
                <span className="text-slate-500">Name: </span>
                {payment.staff_name}
              </p>
              {payment.employee_id && (
                <p>
                  <span className="text-slate-500">Employee ID: </span>
                  {payment.employee_id}
                </p>
              )}
              {payment.staff_email && (
                <p>
                  <span className="text-slate-500">Email: </span>
                  {payment.staff_email}
                </p>
              )}
              <p>
                <span className="text-slate-500">Pay Period: </span>
                {payment.period_label}
              </p>
              {payment.academic_year_name && (
                <p>
                  <span className="text-slate-500">Academic Year: </span>
                  {payment.academic_year_name}
                </p>
              )}
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
                  <td className="border border-slate-200 px-3 py-2">Basic Salary</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{money(payment.basic_salary)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Allowances</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{money(payment.allowances)}</td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2">Deductions (structure)</td>
                  <td className="border border-slate-200 px-3 py-2 text-right text-red-600">
                    -{money(payment.deductions)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 px-3 py-2 font-medium">Base Net Salary</td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-medium">
                    {money(payment.net_salary)}
                  </td>
                </tr>
                {parseFloat(String(payment.leave_deduction || 0)) > 0 && (
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Leave Deduction</td>
                    <td className="border border-slate-200 px-3 py-2 text-right text-red-600">
                      -{money(payment.leave_deduction)}
                    </td>
                  </tr>
                )}
                {parseFloat(String(payment.penalties || 0)) > 0 && (
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Penalties</td>
                    <td className="border border-slate-200 px-3 py-2 text-right text-red-600">
                      -{money(payment.penalties)}
                    </td>
                  </tr>
                )}
                {parseFloat(String(payment.adjustments || 0)) !== 0 && (
                  <tr>
                    <td className="border border-slate-200 px-3 py-2">Adjustments</td>
                    <td
                      className={`border border-slate-200 px-3 py-2 text-right ${
                        parseFloat(String(payment.adjustments)) >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {parseFloat(String(payment.adjustments)) >= 0 ? '+' : ''}
                      {money(payment.adjustments)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <p className="text-right text-xl font-bold text-emerald-700 mt-4">
              Net Paid: {formatMoney(payment.net_salary_to_receive || payment.net_salary)}
            </p>

            <p className="text-sm text-slate-600 mt-2 text-right">
              Mode: {payment.payment_mode || '—'}
              {payment.transaction_id ? ` · Ref: ${payment.transaction_id}` : ''}
            </p>
            {payment.remarks && (
              <p className="text-sm text-slate-600 mt-2">
                <span className="text-slate-500">Remarks: </span>
                {payment.remarks}
              </p>
            )}
            {payment.payment_mode === 'Bank Transfer' &&
              (payment.bank_name || payment.account_number) && (
                <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                  <p className="font-medium text-slate-700 mb-2">Paid via Bank Transfer</p>
                  {payment.bank_name && (
                    <p>
                      <span className="text-slate-500">Bank: </span>
                      {payment.bank_name}
                    </p>
                  )}
                  {payment.ifsc_code && (
                    <p>
                      <span className="text-slate-500">IFSC: </span>
                      {payment.ifsc_code}
                    </p>
                  )}
                  {payment.account_number && (
                    <p>
                      <span className="text-slate-500">Account No: </span>
                      {payment.account_number}
                      {payment.account_holder_name ? ` (${payment.account_holder_name})` : ''}
                    </p>
                  )}
                </div>
              )}
            {payment.payment_mode === 'Online' && payment.upi_id && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                <p className="font-medium text-slate-700 mb-2">Paid via UPI (PhonePe / GPay / Paytm)</p>
                <p>
                  <span className="text-slate-500">UPI ID: </span>
                  {payment.upi_id}
                </p>
              </div>
            )}

            {payment.processed_by_name && (
              <p className="text-xs text-slate-500 mt-4">Processed by: {payment.processed_by_name}</p>
            )}

            {settings.footer_note && (
              <p className="text-center text-sm text-slate-600 mt-8 border-t pt-4">{settings.footer_note}</p>
            )}
            {settings.terms_and_conditions && (
              <p className="text-xs text-slate-400 mt-2 text-center">{settings.terms_and_conditions}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
