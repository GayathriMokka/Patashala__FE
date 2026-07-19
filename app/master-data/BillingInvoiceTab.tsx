'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import MasterDataTabShell, { MasterDataToolbarBtn } from '@/components/master-data/MasterDataTabShell'
import SalaryInvoiceTab from './SalaryInvoiceTab'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface BillingInvoiceTabProps {
  schoolId: number
  token: string
}

export default function BillingInvoiceTab({ schoolId, token }: BillingInvoiceTabProps) {
  const [invoiceType, setInvoiceType] = useState<'fee' | 'salary'>('fee')
  const [form, setForm] = useState({
    header_title: '',
    tagline: 'Fee Payment Receipt',
    invoice_prefix: 'INV',
    footer_note: 'Thank you for your payment.',
    terms_and_conditions:
      'This is a computer-generated receipt and does not require a physical signature.',
    show_logo: true,
    show_gst: false,
    gst_number: '',
  })

  const { data, isLoading } = useQuery(
    ['invoice-settings', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/invoice-settings`, {
        params: { school_id: schoolId },
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    { enabled: !!schoolId && !!token }
  )

  useEffect(() => {
    if (data) {
      setForm({
        header_title: data.header_title || data.school?.name || '',
        tagline: data.tagline || 'Fee Payment Receipt',
        invoice_prefix: data.invoice_prefix || 'INV',
        footer_note: data.footer_note || '',
        terms_and_conditions: data.terms_and_conditions || '',
        show_logo: !!data.show_logo,
        show_gst: !!data.show_gst,
        gst_number: data.gst_number || '',
      })
    }
  }, [data])

  const saveMutation = useMutation(
    async () => {
      const res = await axios.put(
        `${API_URL}/invoice-settings`,
        { school_id: schoolId, ...form },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return res.data
    },
    {
      onSuccess: () => alert('Invoice template saved successfully.'),
      onError: (err: any) => {
        alert(err.response?.data?.error || 'Failed to save invoice template')
      },
    }
  )

  if (isLoading) {
    return (
      <MasterDataTabShell title="Billing" subtitle="Loading…">
        <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">Loading billing settings…</div>
      </MasterDataTabShell>
    )
  }

  return (
    <MasterDataTabShell
      title="Billing"
      subtitle={invoiceType === 'fee' ? 'Fee invoice template' : 'Salary payroll template'}
      filters={
        <div className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/30 p-1 gap-1">
          <button
            type="button"
            onClick={() => setInvoiceType('fee')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              invoiceType === 'fee' ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
            }`}
          >
            Fee Invoice
          </button>
          <button
            type="button"
            onClick={() => setInvoiceType('salary')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              invoiceType === 'salary' ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
            }`}
          >
            Salary Payroll
          </button>
        </div>
      }
      toolbarActions={
        invoiceType === 'fee' ? (
          <MasterDataToolbarBtn onClick={() => saveMutation.mutate()} disabled={saveMutation.isLoading}>
            {saveMutation.isLoading ? 'Saving…' : 'Save Template'}
          </MasterDataToolbarBtn>
        ) : undefined
      }
    >
      {invoiceType === 'salary' && <SalaryInvoiceTab schoolId={schoolId} token={token} />}

      {invoiceType === 'fee' && (
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Header Title (School name on invoice)</label>
            <input
              type="text"
              value={form.header_title}
              onChange={(e) => setForm((f) => ({ ...f, header_title: e.target.value }))}
              placeholder={data?.school?.name || 'School name'}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Tagline / Subtitle</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">Invoice Number Prefix</label>
            <input
              type="text"
              value={form.invoice_prefix}
              onChange={(e) => setForm((f) => ({ ...f, invoice_prefix: e.target.value }))}
              placeholder="INV"
              maxLength={20}
              className="input-field font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">Example: {form.invoice_prefix}-1735123456-ABC123</p>
          </div>
          <div>
            <label className="label-text">GST Number</label>
            <input
              type="text"
              value={form.gst_number}
              onChange={(e) => setForm((f) => ({ ...f, gst_number: e.target.value }))}
              disabled={!form.show_gst}
              className="input-field disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.show_logo}
              onChange={(e) => setForm((f) => ({ ...f, show_logo: e.target.checked }))}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Show school logo on invoice</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.show_gst}
              onChange={(e) => setForm((f) => ({ ...f, show_gst: e.target.checked }))}
              className="rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Show GSTIN on invoice</span>
          </label>
        </div>

        <div>
          <label className="label-text">Footer Note</label>
          <textarea
            value={form.footer_note}
            onChange={(e) => setForm((f) => ({ ...f, footer_note: e.target.value }))}
            rows={2}
            className="input-field"
          />
        </div>

        <div>
          <label className="label-text">Terms & Conditions</label>
          <textarea
            value={form.terms_and_conditions}
            onChange={(e) => setForm((f) => ({ ...f, terms_and_conditions: e.target.value }))}
            rows={3}
            className="input-field"
          />
        </div>

        {data?.school && (
          <div className="p-3 border border-dashed border-white/20 rounded-lg bg-black/20 text-xs text-white/60">
            <p className="font-medium text-white/85 mb-1">School address (from school profile)</p>
            <p>
              {[data.school.address, data.school.city, data.school.state, data.school.pincode]
                .filter(Boolean)
                .join(', ') || '—'}
            </p>
            <p className="text-[10px] mt-2 text-white/45">
              Update address on the Schools page if needed; it appears automatically on invoices.
            </p>
          </div>
        )}
      </div>
      )}
    </MasterDataTabShell>
  )
}
