'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface SalaryInvoiceTabProps {
  schoolId: number
  token: string
}

export default function SalaryInvoiceTab({ schoolId, token }: SalaryInvoiceTabProps) {
  const [form, setForm] = useState({
    header_title: '',
    tagline: 'Salary Payment Slip',
    invoice_prefix: 'SAL',
    footer_note: 'This document confirms salary payment for the period stated above.',
    terms_and_conditions:
      'This is a computer-generated salary payment slip and does not require a physical signature.',
    show_logo: true,
    show_gst: false,
    gst_number: '',
  })

  const { data, isLoading } = useQuery(
    ['salary-invoice-settings', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/salary-invoice-settings`, {
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
        tagline: data.tagline || 'Salary Payment Slip',
        invoice_prefix: data.invoice_prefix || 'SAL',
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
      await axios.put(
        `${API_URL}/salary-invoice-settings`,
        { school_id: schoolId, ...form },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    },
    {
      onSuccess: () => alert('Salary invoice template saved successfully.'),
      onError: (err: any) => {
        alert(err.response?.data?.error || 'Failed to save salary invoice template')
      },
    }
  )

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading salary invoice settings...</p>
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label-text">Header Title (School name on slip)</label>
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
            placeholder="SAL"
            maxLength={20}
            className="input-field font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">Example: {form.invoice_prefix}-42</p>
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
          <span className="text-sm text-slate-700">Show school logo on slip</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.show_gst}
            onChange={(e) => setForm((f) => ({ ...f, show_gst: e.target.checked }))}
            className="rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Show GSTIN on slip</span>
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isLoading}
          className="btn-primary disabled:opacity-50"
        >
          {saveMutation.isLoading ? 'Saving...' : 'Save Default Template'}
        </button>
      </div>
    </div>
  )
}
