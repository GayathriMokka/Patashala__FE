'use client'


import SelectField from '@/components/SelectField'
import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useMemo } from 'react'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import MasterDataTabShell, {
  MasterDataDenseTable,
  MasterDataToolbarBtn,
} from '@/components/master-data/MasterDataTabShell'
import { usePageExport } from '@/lib/usePageExport'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { useUrlQueryState } from '@/lib/useUrlQueryState'
import ExPaymentInvoicePrint, { type ExPaymentInvoiceData } from '@/components/ex-payments/ExPaymentInvoicePrint'
import ExPaymentEditModal from '@/components/ex-payments/ExPaymentEditModal'
import { formatPaymentDateDisplay } from '@/lib/paymentDates'
import { formatMoney } from '@/lib/formatMoney'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { invalidateFinanceQueries } from '@/lib/invalidateFinanceQueries'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const PAYMENT_MODES = ['Cash', 'Card', 'Net Banking', 'UPI'] as const
type PaymentMode = (typeof PAYMENT_MODES)[number]
type ExPaymentsTab = 'collect' | 'history'

const emptyForm = {
  source_id: '',
  payment_date: new Date().toISOString().slice(0, 10),
  amount: '',
  payment_mode: 'Cash' as PaymentMode,
  transaction_id: '',
  payer_name: '',
  payer_mobile: '',
  generate_invoice: false,
  remarks: '',
}

export default function ExPaymentsPage() {
  const { user, token } = useAuth()
  const { academicYear } = useAcademicYear()
  const {
    branch,
    isAllBranches,
    branchScopeKey,
    scopedHeaders: headers,
    requireBranchForWrite,
  } = useBranchYearScope()
  const { canAccess, accessLoading } = useRequirePageAccess('/ex-payments')
  const isAllowed = canAccess

  const [activeTab, setActiveTab] = useUrlQueryState(
    'tab',
    ['collect', 'history'],
    'collect'
  ) as [ExPaymentsTab, (tab: ExPaymentsTab) => void]

  const [form, setForm] = useState(emptyForm)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [invoiceData, setInvoiceData] = useState<ExPaymentInvoiceData | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSourceId, setFilterSourceId] = useState('')
  const [editingPayment, setEditingPayment] = useState<any | null>(null)

  const queryClient = useQueryClient()
  const schoolId = user?.school_id

  const refreshFinance = () => {
    queryClient.invalidateQueries(['ex-payments'])
    invalidateFinanceQueries(queryClient, schoolId, academicYear?.id)
    queryClient.refetchQueries(['revenue-analytics'], { active: true })
    queryClient.refetchQueries(['revenue-reports'], { active: true })
  }

  const { data: sources, isLoading: sourcesLoading } = useQuery(
    ['extra-payment-sources', schoolId],
    async () => {
      const res = await axios.get(`${API_URL}/extra-payment-master/sources`, {
        params: { school_id: schoolId, active_only: 'true' },
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.data.data
    },
    { enabled: !!schoolId && !!token && isAllowed }
  )

  const { data: payments, isLoading: paymentsLoading } = useQuery(
    ['ex-payments', schoolId, academicYear?.id, branchScopeKey, searchTerm, filterSourceId],
    async () => {
      const res = await axios.get(`${API_URL}/ex-payments`, {
        params: {
          school_id: schoolId,
          academic_year_id: academicYear?.id,
          search: searchTerm || undefined,
          source_id: filterSourceId || undefined,
        },
        headers,
      })
      return res.data.data
    },
    { enabled: !!schoolId && !!academicYear?.id && !!token && isAllowed }
  )

  const collectMutation = useMutation(
    async () => {
      const formData = new FormData()
      formData.append('school_id', String(schoolId))
      formData.append('academic_year_id', String(academicYear?.id))
      if (branch?.id) formData.append('branch_id', String(branch.id))
      formData.append('source_id', form.source_id)
      formData.append('payment_date', form.payment_date)
      formData.append('amount', form.amount)
      formData.append('payment_mode', form.payment_mode)
      formData.append('payer_name', form.payer_name.trim())
      if (form.payer_mobile.trim()) formData.append('payer_mobile', form.payer_mobile.trim())
      if (form.transaction_id.trim()) formData.append('transaction_id', form.transaction_id.trim())
      formData.append('generate_invoice', form.generate_invoice ? 'true' : 'false')
      if (form.generate_invoice && form.remarks.trim()) {
        formData.append('remarks', form.remarks.trim())
      }
      if (proofFile) formData.append('payment_proof', proofFile)

      const res = await axios.post(`${API_URL}/ex-payments`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
      })
      return { ...res.data.data, _generateInvoice: form.generate_invoice }
    },
    {
      onSuccess: async (data) => {
        refreshFinance()
        setSuccessMessage(`Payment recorded — Receipt: ${data.receipt_number}`)
        setForm({ ...emptyForm, payment_date: new Date().toISOString().slice(0, 10) })
        setProofFile(null)
        setError('')
        setActiveTab('history')

        if (data._generateInvoice && data.id) {
          await fetchInvoice(data.id)
        }
      },
      onError: (err: any) => {
        setError(err.response?.data?.error || 'Failed to record payment')
        setSuccessMessage('')
      },
    }
  )

  const deleteMutation = useMutation(
    async (id: number) => {
      await axios.delete(`${API_URL}/ex-payments/${id}`, {
        params: { school_id: schoolId, academic_year_id: academicYear?.id },
        headers,
      })
    },
    {
      onSuccess: () => {
        refreshFinance()
        setSuccessMessage('Payment deleted successfully.')
      },
      onError: (err: any) => alert(err.response?.data?.error || 'Failed to delete payment'),
    }
  )

  const fetchInvoice = async (paymentId: number) => {
    setInvoiceLoading(true)
    try {
      const res = await axios.get(`${API_URL}/ex-payments/${paymentId}/invoice`, {
        params: { school_id: schoolId, academic_year_id: academicYear?.id },
        headers,
      })
      setInvoiceData(res.data.data)
    } catch {
      alert('Failed to load invoice')
    } finally {
      setInvoiceLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (isAllBranches) {
      setError('Select a specific branch from the top bar before recording a payment.')
      return
    }

    if (!form.source_id) {
      setError('Please select a payment source')
      return
    }
    if (!form.payer_name.trim()) {
      setError('Payer name is required')
      return
    }
    const amount = parseFloat(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (form.payment_mode !== 'Cash' && !form.transaction_id.trim()) {
      setError('Transaction / UTR reference is required for non-cash payments')
      return
    }

    collectMutation.mutate()
  }

  const activeSources = useMemo(
    () =>
      [...(sources || [])].sort((a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [sources]
  )

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers,
    config: {
      mode: 'data',
      title: 'Extra Payment Collections',
      filename: 'extra_payments',
      getSubtitle: () => {
        const parts: string[] = []
        if (searchTerm.trim()) parts.push(`Search: ${searchTerm.trim()}`)
        if (filterSourceId) {
          const src = activeSources.find((s: { id: number }) => String(s.id) === filterSourceId)
          if (src) parts.push(`Source: ${src.name}`)
        }
        return parts.length ? parts.join(' · ') : undefined
      },
      columns: [
        { key: 'payment_date', label: 'Date' },
        { key: 'receipt_number', label: 'Receipt' },
        { key: 'source_name', label: 'Source' },
        { key: 'branch_name', label: 'Branch' },
        { key: 'payer_name', label: 'Payer' },
        { key: 'payer_mobile', label: 'Mobile' },
        { key: 'payment_mode', label: 'Mode' },
        { key: 'amount', label: 'Amount' },
      ],
      getRows: () =>
        (payments || []).map((p: any) => ({
          payment_date: formatPaymentDateDisplay(p.payment_date),
          receipt_number: p.receipt_number || '',
          source_name: p.source_name || '',
          branch_name: p.branch_name || p.branch_code || '',
          payer_name: p.payer_name || '',
          payer_mobile: p.payer_mobile || '',
          payment_mode: p.payment_mode || '',
          amount: p.amount != null ? formatMoney(p.amount) : '',
        })),
    },
  })

  if (accessLoading || !isAllowed) {
    return (
      <Layout>
        <div className="page-container">
          <div className="alert-error">
            {accessLoading
              ? 'Loading permissions...'
              : 'Access denied. Your role does not have Collections permission. Ask School Admin to grant it under Features.'}
          </div>
        </div>
      </Layout>
    )
  }

  if (!academicYear) {
    return (
      <Layout>
        <div className="page-container">
          <div className="alert-warning">
            Please select an academic year from the top bar to record collections.
          </div>
        </div>
      </Layout>
    )
  }

  const resetCollectForm = () => {
    setForm({ ...emptyForm, payment_date: new Date().toISOString().slice(0, 10) })
    setProofFile(null)
    setError('')
    setSuccessMessage('')
  }

  const paymentCount = payments?.length ?? 0
  const branchScopeLabel =
    !isAllBranches && branch?.name
      ? `${branch.name}${academicYear?.name ? ` · ${academicYear.name}` : ''}`
      : academicYear?.name || ''

  return (
    <Layout>
      <div className="page-container flex flex-col page-container-viewport overflow-hidden">
        <MasterDataTabShell
          className="flex-1 min-h-0"
          title="Collections"
          subtitle={
            activeTab === 'collect'
              ? branchScopeLabel || `${paymentCount} recorded`
              : `${paymentCount} record${paymentCount === 1 ? '' : 's'}`
          }
          filters={
            <>
              <div className="inline-flex flex-wrap rounded-lg border border-white/15 bg-black/30 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('collect')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    activeTab === 'collect' ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
                  }`}
                >
                  Record Payment
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition tabular-nums ${
                    activeTab === 'history' ? 'bg-primary-600 text-white shadow-sm' : 'text-white/65 hover:bg-white/10'
                  }`}
                >
                  Payment History ({paymentCount})
            </button>
              </div>
              {activeTab === 'history' ? (
                <>
                  <PageFilterSearch
                    id="ex_payment_search"
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search name, mobile, receipt…"
                    hideLabel
                    className="master-data-tab-search"
                  />
                  <PageFilterField label="Source" hideLabel className="master-data-tab-select-wide">
                    <SelectField
                      id="ex_payment_source"
                      value={filterSourceId}
                      onChange={(e) => setFilterSourceId(e.target.value)}
                      className="select-field w-full"
                      aria-label="Filter by source"
                    >
                      <option value="">All sources</option>
                      {activeSources.map((s: { id: number; name: string }) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </SelectField>
                  </PageFilterField>
                </>
              ) : branchScopeLabel ? (
                <span className="text-[10px] text-white/50 tabular-nums whitespace-nowrap self-center">
                  {branchScopeLabel}
                </span>
              ) : null}
            </>
          }
          toolbarActions={
            activeTab === 'collect' ? (
              <>
                <MasterDataToolbarBtn
                  type="submit"
                  form="ex-payment-collect-form"
                  disabled={
                    collectMutation.isLoading || activeSources.length === 0 || isAllBranches
                  }
                >
                  {collectMutation.isLoading ? 'Saving…' : 'Save'}
                </MasterDataToolbarBtn>
                <MasterDataToolbarBtn variant="secondary" onClick={resetCollectForm}>
                  Reset
                </MasterDataToolbarBtn>
              </>
            ) : (
              <>
                <MasterDataToolbarBtn onClick={() => setActiveTab('collect')}>Record Payment</MasterDataToolbarBtn>
                <ExportMenu
                  onExport={handleExport}
                  isExporting={isExporting}
                  recordCount={paymentCount}
                  size="sm"
                />
              </>
            )
          }
          footer={activeTab === 'history' && paymentCount ? `Showing ${paymentCount} records` : undefined}
        >
          {isAllBranches && activeTab === 'collect' ? (
            <div className="master-data-tab-banner shrink-0 text-amber-200/95">
              Select a specific branch from the top bar before recording a payment.
            </div>
          ) : null}
          {error ? (
            <div className="master-data-tab-banner shrink-0 text-red-300/95">{error}</div>
          ) : null}
          {successMessage ? (
            <div className="master-data-tab-banner shrink-0 text-emerald-200/95">{successMessage}</div>
          ) : null}
          {exportError ? (
            <div className="master-data-tab-banner shrink-0 text-red-300/95">{exportError}</div>
          ) : null}

          {activeTab === 'collect' ? (
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 sm:px-3 py-3">
              {sourcesLoading ? (
                <p className="text-xs text-white/50 py-4">Loading payment sources…</p>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 max-w-3xl"
                  id="ex-payment-collect-form"
                >
                  <div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-white/45 mb-2">
                      Payment Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="source_id" className="label-text">
                      Payment Source <span className="text-red-300">*</span>
                    </label>
                    <SelectField
                      id="source_id"
                      value={form.source_id}
                      onChange={(e) => setForm({ ...form, source_id: e.target.value })}
                      className="select-field"
                      required
                      disabled={activeSources.length === 0}
                    >
                      <option value="">Select source</option>
                      {activeSources.map((s: { id: number; name: string }) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <div>
                    <label htmlFor="payment_date" className="label-text">
                      Payment Date <span className="text-red-300">*</span>
                    </label>
                    <input
                      id="payment_date"
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="amount" className="label-text">
                      Amount (₹) <span className="text-red-300">*</span>
                    </label>
                    <input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="payment_mode" className="label-text">
                      Payment Mode <span className="text-red-300">*</span>
                    </label>
                    <SelectField
                      id="payment_mode"
                      value={form.payment_mode}
                      onChange={(e) =>
                        setForm({ ...form, payment_mode: e.target.value as PaymentMode })
                      }
                      className="select-field"
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>
              </div>

                  <div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-white/45 mb-2">
                      Payer Information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="payer_name" className="label-text">
                      Payer Name <span className="text-red-300">*</span>
                    </label>
                    <input
                      id="payer_name"
                      type="text"
                      value={form.payer_name}
                      onChange={(e) => setForm({ ...form, payer_name: e.target.value })}
                      placeholder="Full name of payer"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="payer_mobile" className="label-text">
                      Mobile Number
                    </label>
                    <input
                      id="payer_mobile"
                      type="tel"
                      value={form.payer_mobile}
                      onChange={(e) => setForm({ ...form, payer_mobile: e.target.value })}
                      placeholder="10-digit mobile number"
                      className="input-field"
                    />
                  </div>
                  {form.payment_mode !== 'Cash' && (
                    <div className="sm:col-span-2">
                      <label htmlFor="transaction_id" className="label-text">
                        {form.payment_mode === 'UPI' ? 'UTR / Reference No.' : 'Transaction ID'}{' '}
                        <span className="text-red-300">*</span>
                      </label>
                      <input
                        id="transaction_id"
                        type="text"
                        value={form.transaction_id}
                        onChange={(e) => setForm({ ...form, transaction_id: e.target.value })}
                        placeholder="Enter transaction reference"
                        className="input-field"
                      />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label htmlFor="payment_proof" className="label-text">
                      Payment Proof <span className="text-white/50 font-normal">(optional)</span>
                    </label>
                    <input
                      id="payment_proof"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-white/80 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-white/15 file:text-white file:text-xs file:font-medium file:cursor-pointer hover:file:bg-white/20"
                        />
                        {proofFile ? (
                          <p className="text-[10px] text-white/45 mt-1 truncate">Selected: {proofFile.name}</p>
                        ) : null}
                  </div>
                </div>
              </div>

                  <div className="border-t border-white/[0.06] pt-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wide text-white/45 mb-2">
                      Invoice Options
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.generate_invoice}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        generate_invoice: e.target.checked,
                        remarks: e.target.checked ? form.remarks : '',
                      })
                    }
                    className="multi-select-checkbox"
                  />
                      <span className="text-xs font-medium text-white/85">Generate invoice after payment</span>
                    </label>
                    {form.generate_invoice ? (
                      <div className="mt-3">
                        <label htmlFor="remarks" className="label-text">
                          Invoice Remarks
                    </label>
                    <textarea
                      id="remarks"
                      value={form.remarks}
                      onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                          rows={2}
                          placeholder="Optional notes on the invoice"
                          className="input-field resize-y min-h-[4rem]"
                        />
                      </div>
                    ) : null}
                  </div>
                </form>
                )}
              </div>
          ) : paymentsLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
              Loading payments…
              </div>
          ) : !paymentCount ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-xs text-white/55 py-8 px-4 text-center">
              <p>No collections recorded yet.</p>
              <MasterDataToolbarBtn onClick={() => setActiveTab('collect')}>Record Payment</MasterDataToolbarBtn>
              </div>
            ) : (
            <MasterDataDenseTable className="flex-1 min-h-0">
              <table className="data-table data-table-fit w-full">
                <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt</th>
                      <th>Source</th>
                    {isAllBranches ? <th>Branch</th> : null}
                      <th>Payer</th>
                      <th>Mobile</th>
                      <th>Mode</th>
                      <th className="text-right">Amount</th>
                    <th className="text-center">Act.</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-white/[0.06]">
                    {payments.map((p: any) => (
                    <tr key={p.id} className="master-data-table-row hover:bg-white/[0.04]">
                      <td className="tabular-nums whitespace-nowrap text-[11px] text-white/70">
                        {formatPaymentDateDisplay(p.payment_date)}
                      </td>
                      <td className="max-w-0">
                        <span className="md-cell-text font-mono text-white/80">{p.receipt_number}</span>
                      </td>
                      <td className="max-w-0">
                        <span className="md-cell-text">{p.source_name}</span>
                      </td>
                      {isAllBranches ? (
                        <td className="max-w-0">
                          <span className="md-cell-text">{p.branch_name || p.branch_code || '—'}</span>
                        </td>
                      ) : null}
                      <td className="max-w-0">
                        <span className="md-cell-text font-medium text-white">{p.payer_name}</span>
                      </td>
                      <td className="max-w-0">
                        <span className="md-cell-text tabular-nums">{p.payer_mobile || '—'}</span>
                      </td>
                      <td className="max-w-0">
                        <span className="md-cell-text">{p.payment_mode}</span>
                      </td>
                      <td className="text-right tabular-nums text-[11px] font-semibold text-white whitespace-nowrap">
                        {formatMoney(p.amount)}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => fetchInvoice(p.id)}
                            disabled={invoiceLoading}
                            className="md-action-link md-action-edit"
                          >
                            Inv.
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPayment(p)}
                            className="md-action-link md-action-edit"
                          >
                            Edit
                          </button>
                          {(user?.role_name === 'School Admin' || user?.role_name === 'Super Admin') && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Delete this payment record?')) deleteMutation.mutate(p.id)
                              }}
                              className="md-action-link md-action-delete"
                            >
                              Del
                            </button>
                          )}
                        </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </MasterDataDenseTable>
            )}
        </MasterDataTabShell>
      </div>

      {invoiceLoading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
          <div className="glass-card px-6 py-4 text-white text-sm">Loading invoice…</div>
        </div>
      )}

      {invoiceData && !invoiceLoading && (
        <ExPaymentInvoicePrint data={invoiceData} onClose={() => setInvoiceData(null)} />
      )}

      {editingPayment && schoolId && academicYear?.id && token && (
        <ExPaymentEditModal
          payment={editingPayment}
          sources={activeSources}
          schoolId={schoolId}
          academicYearId={academicYear.id}
          token={token}
          onClose={() => setEditingPayment(null)}
          headers={headers}
          onSaved={() => {
            refreshFinance()
            setSuccessMessage('Payment updated successfully.')
            setActiveTab('history')
          }}
        />
      )}
    </Layout>
  )
}
