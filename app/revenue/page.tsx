'use client'

import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { buildBranchScopedHeaders, getBranchScopeKey } from '@/lib/branchAccess'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useMemo, useState, useEffect } from 'react'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { getApiUrl } from '@/lib/api'
import MultiSelectDropdown from '@/components/MultiSelectDropdown'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterClearButton,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport, buildFallbackFilename } from '@/lib/usePageExport'
import { formatMoney } from '@/lib/formatMoney'
import RevenueSummary from '@/components/revenue/RevenueSummary'

const API_URL = getApiUrl()

type RevenueView = 'summary' | 'ledger'

function formatPaymentMethodLabel(method: string) {
  if (method === 'Bank Transfer') return 'Net Banking'
  if (method === 'Online') return 'Card'
  return method
}

function formatPaymentShort(method: string) {
  const label = formatPaymentMethodLabel(method)
  if (label === 'Net Banking') return 'N.Bank'
  if (label === 'Cash') return 'Cash'
  if (label === 'UPI') return 'UPI'
  if (label === 'Card') return 'Card'
  if (label === 'Cheque') return 'Chq.'
  return label.length > 8 ? `${label.slice(0, 7)}…` : label
}

function truncateReference(ref: string, maxLen = 16) {
  const value = String(ref || '').trim()
  if (!value) return '—'
  if (value.length <= maxLen) return value
  const tail = value.slice(-8)
  const head = value.slice(0, 4)
  return `${head}…${tail}`
}

function normalizePaymentMethodForFilter(method: string) {
  if (method === 'Bank Transfer') return 'Net Banking'
  if (method === 'Online') return 'Card'
  return method
}

function paymentMethodsMatch(selected: string, actual: string) {
  const normalizedSelected = normalizePaymentMethodForFilter(selected).toLowerCase()
  const normalizedActual = normalizePaymentMethodForFilter(actual).toLowerCase()
  return normalizedSelected === normalizedActual
}

function sumCollectionAmount(transactions: Array<Record<string, unknown>>) {
  return transactions.reduce((sum, tx) => {
    const direction = String(tx.direction || '').toLowerCase()
    const status = String(tx.status || '').toLowerCase()
    const module = String(tx.module || '').toLowerCase()
    if (direction === 'outflow' || status === 'refunded' || module.includes('refund')) {
      return sum
    }
    return sum + Number(tx.amount || 0)
  }, 0)
}

function formatTxDate(raw: unknown) {
  if (!raw) return '—'
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function resolveLedgerPartyName(
  tx: Record<string, unknown>,
  feeNameByReceipt: Map<string, string>,
  feeNameByPaymentId: Map<number, string>,
  staffNameById: Map<number, string>
) {
  const direct = String(tx.party_name ?? (tx as { partyName?: string }).partyName ?? '').trim()
  if (direct) return direct

  const module = String(tx.module || '').toLowerCase()
  if (module === 'fees') {
    if (tx.reference_number) {
      const byReceipt = feeNameByReceipt.get(String(tx.reference_number))
      if (byReceipt) return byReceipt
    }
    const byPaymentId = feeNameByPaymentId.get(Number(tx.source_id))
    if (byPaymentId) return byPaymentId
  }

  if (module === 'salaries') {
    const staffMatch = String(tx.description || '').match(/staff #(\d+)/i)
    if (staffMatch?.[1]) {
      const staffName = staffNameById.get(Number(staffMatch[1]))
      if (staffName) return staffName
    }
  }

  if (module === 'expenses' && tx.description) {
    const expenseLabel = String(tx.description).replace(/^Expense:\s*/i, '').trim()
    if (expenseLabel) return expenseLabel
  }

  if (module === 'ex_payments' && tx.description) {
    const label = String(tx.description).replace(/^Extra payment:\s*/i, '').trim()
    if (label) return label
  }

  return '—'
}

type LedgerClassInfo = { class_id: number | null; class_name: string }

function resolveLedgerClass(
  tx: Record<string, unknown>,
  feeClassByReceipt: Map<string, LedgerClassInfo>,
  feeClassByPaymentId: Map<number, LedgerClassInfo>
): LedgerClassInfo {
  const directName = String(tx.class_name ?? '').trim()
  const directId =
    tx.class_id != null && tx.class_id !== '' ? Number(tx.class_id) : null
  if (directName) return { class_id: directId, class_name: directName }

  const module = String(tx.module || '').toLowerCase()
  if (module === 'fees') {
    if (tx.reference_number) {
      const byReceipt = feeClassByReceipt.get(String(tx.reference_number))
      if (byReceipt?.class_name) return byReceipt
    }
    const byPaymentId = feeClassByPaymentId.get(Number(tx.source_id))
    if (byPaymentId?.class_name) return byPaymentId
  }

  return { class_id: directId, class_name: '' }
}

function getLedgerNameHint(tx: Record<string, unknown>): string | null {
  const module = String(tx.module || '').toLowerCase()
  if (module === 'fees' && tx.reference_number) {
    return String(tx.reference_number)
  }
  if (module === 'salaries') {
    const period = String(tx.description || '').match(/\((\d{2}-\d{4})\)/)
    if (period?.[1]) return `Salary · ${period[1]}`
    if (tx.reference_number) return String(tx.reference_number)
  }
  if (module === 'expenses' && tx.description) {
    return String(tx.description).replace(/^Expense:\s*/i, '')
  }
  if (module === 'revenue' && tx.reference_number) {
    return String(tx.reference_number)
  }
  if (module === 'ex_payments' && tx.reference_number) {
    return String(tx.reference_number)
  }
  return null
}

function transactionMatchesSearch(
  tx: Record<string, unknown>,
  query: string,
  feeNameByReceipt: Map<string, string>,
  feeNameByPaymentId: Map<number, string>,
  staffNameById: Map<number, string>,
  feeClassByReceipt: Map<string, LedgerClassInfo>,
  feeClassByPaymentId: Map<number, LedgerClassInfo>
) {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const partyName = resolveLedgerPartyName(
    tx,
    feeNameByReceipt,
    feeNameByPaymentId,
    staffNameById
  )
  const classInfo = resolveLedgerClass(tx, feeClassByReceipt, feeClassByPaymentId)
  const nameHint = getLedgerNameHint(tx)
  const paymentMethod = String(tx.payment_method || '')

  const haystack = [
    partyName,
    nameHint,
    String(tx.module || ''),
    classInfo.class_name,
    paymentMethod,
    formatPaymentMethodLabel(paymentMethod),
    String(tx.status || ''),
    String(tx.reference_number || ''),
    String(tx.description || ''),
    String(tx.amount || ''),
    formatTxDate(tx.transaction_date || tx.date || tx.created_at),
  ]
    .filter((part) => part && part !== '—')
    .join(' ')
    .toLowerCase()

  return haystack.includes(q)
}

type KpiTone = 'positive' | 'negative' | 'neutral' | 'warning' | 'accent'

type KpiMetric = {
  label: string
  value: string
  hint?: string
  tone: KpiTone
}

const TONE_STYLES: Record<KpiTone, { accent: string; value: string }> = {
  positive: { accent: 'border-emerald-400/50', value: 'text-emerald-100' },
  negative: { accent: 'border-red-400/50', value: 'text-red-100' },
  warning: { accent: 'border-amber-400/50', value: 'text-amber-100' },
  accent: { accent: 'border-blue-400/50', value: 'text-blue-100' },
  neutral: { accent: 'border-white/15', value: 'text-white' },
}

function RevenueKpiStrip({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="revenue-kpi-strip glass-card-opaque p-0 overflow-hidden shrink-0">
      <div className="flex divide-x divide-white/10">
        {metrics.map((metric) => {
          const styles = TONE_STYLES[metric.tone]
          return (
            <div
              key={metric.label}
              className={`flex-1 min-w-0 px-2 py-1.5 border-l-2 ${styles.accent}`}
              title={metric.hint}
            >
              <p className="text-[9px] font-semibold text-white/55 uppercase tracking-wide leading-none truncate">
                {metric.label}
              </p>
              <p
                className={`text-sm font-bold tabular-nums mt-0.5 leading-none truncate ${styles.value}`}
              >
                {metric.value}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModuleBadge({ module }: { module: string }) {
  const m = String(module || '').toLowerCase()
  const cls =
    m === 'fees'
      ? 'revenue-cell-tag revenue-cell-tag--info'
      : m === 'expenses'
        ? 'revenue-cell-tag revenue-cell-tag--warning'
        : m === 'salaries'
          ? 'revenue-cell-tag revenue-cell-tag--violet'
          : m === 'revenue'
            ? 'revenue-cell-tag revenue-cell-tag--success'
            : m === 'ex_payments'
              ? 'revenue-cell-tag revenue-cell-tag--cyan'
              : m === 'transport'
                ? 'revenue-cell-tag revenue-cell-tag--info'
                : 'revenue-cell-tag'
  const label =
    m === 'ex_payments'
      ? 'Coll.'
      : m === 'expenses'
        ? 'Exp.'
        : m === 'salaries'
          ? 'Sal.'
          : m === 'transport'
            ? 'Trn.'
            : m === 'fees'
              ? 'Fees'
              : module || '—'
  return <span className={cls}>{label}</span>
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || '').toLowerCase()
  if (s === 'completed') return <span className="revenue-cell-tag revenue-cell-tag--success">Done</span>
  if (s === 'pending') return <span className="revenue-cell-tag revenue-cell-tag--warning">Pending</span>
  if (s === 'refunded') return <span className="revenue-cell-tag revenue-cell-tag--danger">Refund</span>
  return <span className="revenue-cell-tag">{status || '—'}</span>
}

function shouldRetryQuery(failureCount: number, error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 401 || status === 403) return false
  return failureCount < 1
}

export default function RevenuePage() {
  const { user, token, isLoading: authLoading, isAuthenticated } = useAuth()
  const { academicYear, isLoading: yearLoading } = useAcademicYear()
  const { branch, isAllBranches } = useBranch()
  const branchScopeKey = getBranchScopeKey(branch?.id, isAllBranches)
  const { canAccess, accessLoading } = useRequirePageAccess('/revenue')
  const isAllowed = canAccess
  const schoolId = user?.school_id != null ? Number(user.school_id) : null

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [transactionTypes, setTransactionTypes] = useState<string[]>([])
  const [paymentTypes, setPaymentTypes] = useState<string[]>([])
  const [filterClassIds, setFilterClassIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [exportError, setExportError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<RevenueView>('ledger')

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const queryEnabled =
    isAuthenticated &&
    !authLoading &&
    !yearLoading &&
    !!token &&
    !!schoolId &&
    !!academicYear?.id &&
    isAllowed

  const scopedHeaders = useMemo(
    () =>
      buildBranchScopedHeaders(token || '', {
        academicYearId: academicYear?.id,
        branchId: branch?.id,
        isAllBranches,
      }),
    [token, academicYear?.id, branch?.id, isAllBranches]
  )

  const requestConfig = useMemo(
    () => ({
      params: {
        school_id: schoolId,
        academic_year_id: academicYear?.id,
      },
      headers: scopedHeaders,
    }),
    [schoolId, academicYear?.id, scopedHeaders]
  )

  const analyticsQuery = useQuery(
    ['revenue-analytics', schoolId, academicYear?.id, branchScopeKey, token],
    async () => {
      const response = await axios.get(`${API_URL}/revenue/analytics`, requestConfig)
      return response.data.data
    },
    { enabled: queryEnabled, staleTime: 0, retry: shouldRetryQuery }
  )

  const reportsQuery = useQuery(
    ['revenue-reports', 'v2', schoolId, academicYear?.id, branchScopeKey, token],
    async () => {
      const response = await axios.get(`${API_URL}/revenue/reports`, requestConfig)
      return response.data
    },
    { enabled: queryEnabled, staleTime: 0, retry: shouldRetryQuery }
  )

  const { data: feePayments } = useQuery(
    ['payments-for-revenue-ledger', schoolId, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/payments`, requestConfig)
      return response.data.data as Array<{
        id: number
        receipt_number?: string
        first_name?: string
        last_name?: string
        class_id?: number
        class_name?: string
      }>
    },
    { enabled: queryEnabled, staleTime: 0 }
  )

  const { data: classes } = useQuery(
    ['classes-for-revenue-ledger', schoolId, academicYear?.id, branchScopeKey],
    async () => {
      const response = await axios.get(`${API_URL}/classes`, requestConfig)
      return response.data.data as Array<{ id: number; name: string; level?: number }>
    },
    { enabled: queryEnabled, staleTime: 0 }
  )

  const { data: teachers } = useQuery(
    ['teachers-for-revenue-ledger', schoolId],
    async () => {
      const response = await axios.get(`${API_URL}/teachers`, {
        params: { school_id: schoolId },
        headers: scopedHeaders,
      })
      return response.data.data as Array<{ id: number; name?: string }>
    },
    { enabled: queryEnabled, staleTime: 0 }
  )

  const feeNameByReceipt = useMemo(() => {
    const map = new Map<string, string>()
    ;(feePayments || []).forEach((payment) => {
      const name = `${payment.first_name || ''} ${payment.last_name || ''}`.trim()
      if (name && payment.receipt_number) {
        map.set(String(payment.receipt_number), name)
      }
    })
    return map
  }, [feePayments])

  const feeNameByPaymentId = useMemo(() => {
    const map = new Map<number, string>()
    ;(feePayments || []).forEach((payment) => {
      const name = `${payment.first_name || ''} ${payment.last_name || ''}`.trim()
      if (name && payment.id) {
        map.set(Number(payment.id), name)
      }
    })
    return map
  }, [feePayments])

  const staffNameById = useMemo(() => {
    const map = new Map<number, string>()
    ;(teachers || []).forEach((teacher) => {
      if (teacher.id && teacher.name) {
        map.set(Number(teacher.id), String(teacher.name).trim())
      }
    })
    return map
  }, [teachers])

  const feeClassByReceipt = useMemo(() => {
    const map = new Map<string, LedgerClassInfo>()
    ;(feePayments || []).forEach((payment) => {
      const className = String(payment.class_name || '').trim()
      if (className && payment.receipt_number) {
        map.set(String(payment.receipt_number), {
          class_id: payment.class_id != null ? Number(payment.class_id) : null,
          class_name: className,
        })
      }
    })
    return map
  }, [feePayments])

  const feeClassByPaymentId = useMemo(() => {
    const map = new Map<number, LedgerClassInfo>()
    ;(feePayments || []).forEach((payment) => {
      const className = String(payment.class_name || '').trim()
      if (className && payment.id) {
        map.set(Number(payment.id), {
          class_id: payment.class_id != null ? Number(payment.class_id) : null,
          class_name: className,
        })
      }
    })
    return map
  }, [feePayments])

  const classOptions = useMemo(() => {
    return [...(classes || [])].sort((a, b) => {
      const levelA = a.level ?? 0
      const levelB = b.level ?? 0
      if (levelA !== levelB) return levelA - levelB
      return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' })
    })
  }, [classes])

  const loadError = useMemo(() => {
    const err =
      analyticsQuery.error ||
      reportsQuery.error
    const axiosErr = err as { response?: { status?: number; data?: { error?: string } } }
    if (axiosErr?.response?.status === 401) {
      return 'Your session has expired. Please log out and sign in again.'
    }
    return axiosErr?.response?.data?.error || null
  }, [analyticsQuery.error, reportsQuery.error])

  const analytics = analyticsQuery.data
  const transactions = reportsQuery.data?.data || []
  const isLoading =
    authLoading || yearLoading || analyticsQuery.isLoading || reportsQuery.isLoading

  const transactionTypeOptions = useMemo(
    () => [
      { value: 'collections', label: 'Collections' },
      { value: 'payments', label: 'Payments' },
      { value: 'refund', label: 'Refund' },
    ],
    []
  )

  const paymentTypeOptions = useMemo(() => {
    const values = new Set<string>()
    transactions.forEach((tx: { payment_method?: string }) => {
      if (tx?.payment_method) {
        values.add(normalizePaymentMethodForFilter(String(tx.payment_method)))
      }
    })
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((method) => ({
        value: method,
        label: formatPaymentMethodLabel(method),
      }))
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx: Record<string, unknown>) => {
      const transactionDateRaw = tx.transaction_date || tx.date || tx.created_at
      const transactionDate = transactionDateRaw ? new Date(String(transactionDateRaw)) : null
      const txDirection = String(tx.direction || '').toLowerCase()
      const txModule = String(tx.module || '').toLowerCase()
      const txPayment = String(tx.payment_method || '')
      const txStatus = String(tx.status || '').toLowerCase()

      if (fromDate && transactionDate && transactionDate < new Date(`${fromDate}T00:00:00`)) return false
      if (toDate && transactionDate && transactionDate > new Date(`${toDate}T23:59:59`)) return false

      if (transactionTypes.length > 0) {
        const matchesType = transactionTypes.some((type) => {
          if (type === 'collections') {
            return !(
              txDirection === 'outflow' ||
              txModule.includes('refund') ||
              txStatus === 'refunded'
            )
          }
          if (type === 'payments') {
            return (
              txDirection === 'outflow' &&
              (txModule === 'expenses' || txModule === 'salaries')
            )
          }
          if (type === 'refund') {
            return txStatus === 'refunded' || txModule.includes('refund')
          }
          return false
        })
        if (!matchesType) return false
      }

      if (
        paymentTypes.length > 0 &&
        !paymentTypes.some((method) => paymentMethodsMatch(method, txPayment))
      ) {
        return false
      }

      if (filterClassIds.length > 0) {
        const { class_id: txClassId } = resolveLedgerClass(
          tx,
          feeClassByReceipt,
          feeClassByPaymentId
        )
        if (!txClassId || !filterClassIds.includes(String(txClassId))) return false
      }

      if (
        !transactionMatchesSearch(
          tx,
          searchTerm,
          feeNameByReceipt,
          feeNameByPaymentId,
          staffNameById,
          feeClassByReceipt,
          feeClassByPaymentId
        )
      ) {
        return false
      }

      return true
    })
  }, [
    transactions,
    fromDate,
    toDate,
    transactionTypes,
    paymentTypes,
    filterClassIds,
    searchTerm,
    feeClassByReceipt,
    feeClassByPaymentId,
    feeNameByReceipt,
    feeNameByPaymentId,
    staffNameById,
  ])

  const hasActiveFilters =
    !!fromDate ||
    !!toDate ||
    transactionTypes.length > 0 ||
    paymentTypes.length > 0 ||
    filterClassIds.length > 0 ||
    !!searchTerm.trim()

  const { isExporting, handleExport } = usePageExport({
    enabled: queryEnabled,
    headers: scopedHeaders,
    config: {
      mode: 'api',
      url: `${API_URL}/revenue/reports`,
      getParams: (format) => ({
        school_id: schoolId,
        academic_year_id: academicYear?.id,
        format,
        transaction_type: transactionTypes.length === 1 ? transactionTypes[0] : 'all',
        filter_start_date: fromDate || undefined,
        filter_end_date: toDate || undefined,
        filter_payment_mode: paymentTypes.length === 1 ? paymentTypes[0] : 'all',
        filter_class_id: filterClassIds.length === 1 ? filterClassIds[0] : 'all',
      }),
      getFallbackFilename: (format) => buildFallbackFilename('revenue_ledger', format),
    },
    onError: (message) => setExportError(message),
  })

  const kpiMetrics = useMemo<KpiMetric[]>(
    () => {
      if (!analytics) return []

      const profit = Number(analytics.net_revenue || 0)
      const totalCollections = hasActiveFilters
        ? sumCollectionAmount(filteredTransactions)
        : Number(analytics.total_revenue || 0)

      return [
        {
          label: "Today's Collections",
          value: formatMoney(analytics.today_collections, { compact: true }),
          hint: 'Fee payments and collections received today',
          tone: 'positive',
        },
        {
          label: 'Total Collections',
          value: formatMoney(totalCollections, { compact: true }),
          hint: hasActiveFilters ? 'Matching current filters' : 'Fees, collections & manual revenue',
          tone: 'positive',
        },
        {
          label: 'Payments',
          value: formatMoney(analytics.total_outflow, { compact: true }),
          hint: 'Expenses & salaries',
          tone: 'negative',
        },
        {
          label: 'Refund',
          value: formatMoney(analytics.refunded_amount, { compact: true }),
          hint: 'Refunded to students',
          tone: 'warning',
        },
        {
          label: 'Profit',
          value: formatMoney(profit, { compact: true }),
          hint: 'Collections − payments',
          tone: profit >= 0 ? 'accent' : 'negative',
        },
      ]
    },
    [analytics, hasActiveFilters, filteredTransactions]
  )

  const revenueTabClass = (active: boolean) =>
    `inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
      active
        ? 'bg-primary-600 text-white shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`

  if (accessLoading || !isAllowed) return null

  if (authLoading || yearLoading) {
    return (
      <Layout>
        <div className="page-container flex flex-col page-container-viewport overflow-hidden">
          <div className="glass-card p-8 text-center text-white/60">Loading revenue data…</div>
        </div>
      </Layout>
    )
  }

  if (!schoolId) {
    return (
      <Layout>
        <div className="alert-error">
          <p className="text-sm">
            Your account is not linked to a school. Revenue requires a school-scoped login.
          </p>
        </div>
      </Layout>
    )
  }

  if (!academicYear?.id) {
    return (
      <Layout>
        <div className="alert-info">
          <p className="text-sm">
            Select an academic year from the header dropdown to view revenue analytics.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-container flex flex-col page-container-viewport overflow-hidden">
        {loadError && (
          <div className="shrink-0 pb-3">
            <div className="alert-error py-2">
              <p className="text-sm">
                <span className="font-medium">Could not load revenue data:</span> {loadError}
              </p>
            </div>
          </div>
        )}

        {isLoading && !loadError && (
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <div className="glass-card p-0 overflow-hidden flex shrink-0">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex-1 h-11 border-r border-white/10 bg-white/5 animate-pulse last:border-r-0"
                />
              ))}
            </div>
            <div className="glass-card flex-1 min-h-0 animate-pulse" />
          </div>
        )}

        {!isLoading && !loadError && analytics && (
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <RevenueKpiStrip metrics={kpiMetrics} />

            <div className="revenue-view-bar glass-card-opaque shrink-0 px-2 py-1.5 flex flex-wrap items-center gap-2">
              <div className="expenses-status-tabs" role="tablist" aria-label="Revenue views">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === 'summary'}
                  onClick={() => setActiveView('summary')}
                  className={revenueTabClass(activeView === 'summary')}
                >
                  <svg className="w-3 h-3 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Summary
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeView === 'ledger'}
                  onClick={() => setActiveView('ledger')}
                  className={revenueTabClass(activeView === 'ledger')}
                >
                  <svg className="w-3 h-3 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Ledger
                  <span className="px-1 py-px rounded-full text-[10px] font-bold leading-tight bg-white/15 text-white/90">
                    {filteredTransactions.length}
                  </span>
                </button>
              </div>
              {hasActiveFilters ? (
                <span className="text-[10px] text-white/45 ml-auto">
                  Filters applied · {filteredTransactions.length} / {transactions.length} records
                </span>
              ) : null}
            </div>

            {activeView === 'summary' ? (
              <div className="table-shell flex-1 min-h-0 overflow-hidden">
                <RevenueSummary
                  transactions={filteredTransactions}
                  analytics={analytics}
                  recordLabel={`${filteredTransactions.length} / ${transactions.length} records`}
                />
              </div>
            ) : (
            <div className="table-shell revenue-ledger-panel flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 revenue-toolbar">
                <div className="revenue-unified-toolbar-row">
                  <div className="revenue-toolbar-meta shrink-0">
                    <h2 className="text-xs font-semibold text-white leading-none">Ledger</h2>
                    <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                      {filteredTransactions.length} / {transactions.length} records
                    </p>
                  </div>

                  <div className="revenue-toolbar-divider" aria-hidden />

                  <PageFilterField id="rev-from-date" label="From" hideLabel className="revenue-toolbar-date">
                    <input
                      id="rev-from-date"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="input-field w-full"
                      aria-label="From date"
                    />
                  </PageFilterField>

                  <PageFilterField id="rev-to-date" label="To" hideLabel className="revenue-toolbar-date">
                    <input
                      id="rev-to-date"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="input-field w-full"
                      aria-label="To date"
                    />
                  </PageFilterField>

                  <PageFilterField id="rev-tx-type" label="Type" hideLabel className="revenue-toolbar-select">
                    <MultiSelectDropdown
                      id="rev-tx-type"
                      options={transactionTypeOptions}
                      value={transactionTypes}
                      onChange={setTransactionTypes}
                      placeholder="Type"
                      compact
                      maxDisplayLabels={1}
                      className="w-full"
                      aria-label="Filter by transaction type"
                    />
                  </PageFilterField>

                  <PageFilterField id="rev-payment" label="Payment" hideLabel className="revenue-toolbar-select">
                    <MultiSelectDropdown
                      id="rev-payment"
                      options={paymentTypeOptions}
                      value={paymentTypes}
                      onChange={setPaymentTypes}
                      placeholder="Pay"
                      compact
                      maxDisplayLabels={1}
                      className="w-full"
                      aria-label="Filter by payment method"
                    />
                  </PageFilterField>

                  <PageFilterField id="rev-class" label="Class" hideLabel className="revenue-toolbar-select">
                    <MultiSelectDropdown
                      id="rev-class"
                      options={classOptions.map((cls) => ({
                        value: String(cls.id),
                        label: cls.name,
                      }))}
                      value={filterClassIds}
                      onChange={setFilterClassIds}
                      placeholder="Class"
                      compact
                      maxDisplayLabels={1}
                      className="w-full"
                      aria-label="Filter by class"
                    />
                  </PageFilterField>

                  <PageFilterSearch
                    id="rev-ledger-search"
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search…"
                    hideLabel
                    className="revenue-toolbar-search"
                  />

                  <PageFilterActions className="revenue-toolbar-actions pb-0">
                    {hasActiveFilters ? (
                      <PageFilterClearButton
                        label="Clear"
                        className="revenue-toolbar-clear"
                        onClick={() => {
                          setFromDate('')
                          setToDate('')
                          setTransactionTypes([])
                          setPaymentTypes([])
                          setFilterClassIds([])
                          setSearchTerm('')
                        }}
                      />
                    ) : null}
                    <ExportMenu
                      onExport={(format) => {
                        setExportError(null)
                        return handleExport(format)
                      }}
                      isExporting={isExporting}
                      recordCount={filteredTransactions.length}
                      size="sm"
                    />
                  </PageFilterActions>
                </div>
              </div>

              {exportError && (
                <p className="shrink-0 px-3 py-1 text-[11px] text-red-200 border-b border-white/10" role="alert">
                  {exportError}
                </p>
              )}

              <div className="revenue-ledger-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                <table className="data-table data-table-fit revenue-ledger-table w-full">
                  <colgroup>
                    <col className="revenue-ledger-col-date" />
                    <col className="revenue-ledger-col-module" />
                    <col className="revenue-ledger-col-class" />
                    <col className="revenue-ledger-col-name" />
                    <col className="revenue-ledger-col-ref" />
                    <col className="revenue-ledger-col-payment" />
                    <col className="revenue-ledger-col-status" />
                    <col className="revenue-ledger-col-amount" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="revenue-ledger-col-date">Date</th>
                      <th className="revenue-ledger-col-module">Mod.</th>
                      <th className="revenue-ledger-col-class">Class</th>
                      <th className="revenue-ledger-col-name">Name</th>
                      <th className="revenue-ledger-col-ref">Reference</th>
                      <th className="revenue-ledger-col-payment">Pay.</th>
                      <th className="revenue-ledger-col-status">Status</th>
                      <th className="revenue-ledger-col-amount text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredTransactions.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-white/50 text-xs">
                          No transactions match your filters or search.
                        </td>
                      </tr>
                    )}
                    {filteredTransactions.map((tx: Record<string, unknown>, index: number) => {
                      const isOutflow = String(tx.direction || '').toLowerCase() === 'outflow'
                      const txKey = tx.id
                        ? `tx-${tx.id}`
                        : `tx-${index}-${tx.reference_number || 'ref'}`
                      const partyName = resolveLedgerPartyName(
                        tx,
                        feeNameByReceipt,
                        feeNameByPaymentId,
                        staffNameById
                      )
                      const nameHint = getLedgerNameHint(tx)
                      const classInfo = resolveLedgerClass(
                        tx,
                        feeClassByReceipt,
                        feeClassByPaymentId
                      )

                      return (
                        <tr key={txKey} className="revenue-ledger-row hover:bg-white/[0.04]">
                          <td className="revenue-ledger-col-date text-white/80 max-w-0">
                            <span className="block truncate">
                              {formatTxDate(tx.transaction_date || tx.date || tx.created_at)}
                            </span>
                          </td>
                          <td className="revenue-ledger-col-module">
                            <ModuleBadge module={String(tx.module || '')} />
                          </td>
                          <td className="revenue-ledger-col-class max-w-0">
                            <span
                              className="block truncate text-white/85"
                              title={classInfo.class_name || undefined}
                            >
                              {classInfo.class_name || '—'}
                            </span>
                          </td>
                          <td className="revenue-ledger-col-name max-w-0">
                            <span className="block truncate font-medium text-white" title={partyName}>
                              {partyName}
                            </span>
                          </td>
                          <td className="revenue-ledger-col-ref max-w-0">
                            {(() => {
                              const fullRef =
                                nameHint || String(tx.reference_number || '').trim() || '—'
                              return (
                                <span
                                  className="block truncate font-mono text-[10px] text-white/45"
                                  title={fullRef !== '—' ? fullRef : undefined}
                                >
                                  {truncateReference(fullRef)}
                                </span>
                              )
                            })()}
                          </td>
                          <td className="revenue-ledger-col-payment text-white/80 max-w-0">
                            <span
                              className="block truncate"
                              title={
                                tx.payment_method
                                  ? formatPaymentMethodLabel(String(tx.payment_method))
                                  : undefined
                              }
                            >
                              {tx.payment_method
                                ? formatPaymentShort(String(tx.payment_method))
                                : '—'}
                            </span>
                          </td>
                          <td className="revenue-ledger-col-status">
                            <StatusBadge status={String(tx.status || '')} />
                          </td>
                          <td className="revenue-ledger-col-amount text-right max-w-0">
                            <span
                              className={`block truncate font-semibold tabular-nums text-[11px] ${
                                isOutflow ? 'text-red-300' : 'text-emerald-300'
                              }`}
                              title={`${isOutflow ? '−' : '+'}${formatMoney(Number(tx.amount || 0))}`}
                            >
                              {isOutflow ? '−' : '+'}
                              {formatMoney(Number(tx.amount || 0), { compact: true })}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
