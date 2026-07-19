'use client'

import SelectField from '@/components/SelectField'
import ExportMenu from '@/components/ExportMenu'
import TransportKpiStrip from '@/components/transport/TransportKpiStrip'
import {
  PageFilterActions,
  PageFilterClearButton,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import { usePageExport } from '@/lib/usePageExport'
import { formatPaymentDateDisplay } from '@/lib/paymentDates'
import { formatMoney } from '@/lib/formatMoney'
import { useMemo, useRef } from 'react'
import type { TransportDashboard, TransportPayment } from '@/lib/transportTypes'
import { PAYMENT_MODES } from '@/lib/transportTypes'
import type { AcademicYearDateScope } from '@/lib/academicYearDates'

const compactSelect = 'select-field w-full min-w-0'

function TransportPaymentColgroup() {
  return (
    <colgroup>
      <col className="tp-col-receipt" />
      <col className="tp-col-date" />
      <col className="tp-col-student" />
      <col className="tp-col-route" />
      <col className="tp-col-trip" />
      <col className="tp-col-amount" />
      <col className="tp-col-discount" />
      <col className="tp-col-collected" />
      <col className="tp-col-mode" />
      <col className="tp-col-collector" />
      <col className="tp-col-status" />
      <col className="tp-col-actions" />
    </colgroup>
  )
}

type Filters = {
  search: string
  classId: string
  sectionId: string
  routeId: string
  tripSelection: string
  vanId: string
  paymentMode: string
  dateFrom: string
  dateTo: string
  receiptNumber: string
}

type Props = {
  payments?: TransportPayment[]
  loading?: boolean
  dashboard?: TransportDashboard | null
  dashboardLoading?: boolean
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  classes: { id: number; name: string }[]
  sections: { id: number; name: string; class_id: number }[]
  routes: { id: number; route_name: string }[]
  vans: { id: number; vehicle_number: string }[]
  headers: Record<string, string>
  token: string
  canReprint: boolean
  onView: (payment: TransportPayment) => void
  academicYear?: AcademicYearDateScope
  dateMin?: string
  dateMax?: string
}

export default function PaymentHistoryTab({
  payments = [],
  loading,
  dashboard,
  dashboardLoading,
  filters,
  onFiltersChange,
  classes,
  routes,
  vans,
  headers,
  token,
  canReprint,
  onView,
  dateMin,
  dateMax,
}: Props) {
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const footerScrollRef = useRef<HTMLDivElement>(null)

  const syncFooterScroll = () => {
    const body = bodyScrollRef.current
    const footer = footerScrollRef.current
    if (body && footer) footer.scrollLeft = body.scrollLeft
  }

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers,
    config: {
      mode: 'data',
      title: 'Transport Payment History',
      filename: 'transport_payments',
      columns: [
        { key: 'receipt_number', label: 'Receipt No' },
        { key: 'payment_date', label: 'Payment Date' },
        { key: 'student_name', label: 'Student' },
        { key: 'route_name', label: 'Route' },
        { key: 'trip_selection', label: 'Trip' },
        { key: 'amount', label: 'Amount' },
        { key: 'discount', label: 'Discount' },
        { key: 'final_amount', label: 'Collected' },
        { key: 'payment_mode', label: 'Mode' },
        { key: 'collected_by_name', label: 'Collected By' },
        { key: 'status', label: 'Status' },
      ],
      getRows: () =>
        payments.map((p) => ({
          ...p,
          payment_date: formatPaymentDateDisplay(p.payment_date),
        })),
    },
  })

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.classId ||
      filters.sectionId ||
      filters.routeId ||
      filters.tripSelection ||
      filters.vanId ||
      filters.paymentMode ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.receiptNumber
  )

  const clearFilters = () =>
    onFiltersChange({
      search: '',
      classId: '',
      sectionId: '',
      routeId: '',
      tripSelection: '',
      vanId: '',
      paymentMode: '',
      receiptNumber: '',
    })

  const paymentTotals = useMemo(
    () =>
      payments.reduce(
        (acc, row) => ({
          amount: acc.amount + Number(row.amount || 0),
          discount: acc.discount + Number(row.discount || 0),
          collected: acc.collected + Number(row.final_amount || 0),
        }),
        { amount: 0, discount: 0, collected: 0 }
      ),
    [payments]
  )

  return (
    <>
      <TransportKpiStrip metrics={dashboard} loading={dashboardLoading} />

      <div className="shrink-0 px-2 sm:px-3 py-1.5 border-b border-white/10 transport-toolbar-filters">
        <div className="transport-unified-toolbar-row">
          <PageFilterSearch
            value={filters.search}
            onChange={(search) => onFiltersChange({ search })}
            placeholder="Student…"
            className="transport-toolbar-search"
            id="transport_pay_search"
          />

          <PageFilterField label="Receipt" hideLabel className="transport-toolbar-select-wide">
            <input
              id="transport_pay_receipt"
              type="text"
              className="input-field w-full min-w-0"
              placeholder="Receipt #"
              value={filters.receiptNumber}
              onChange={(e) => onFiltersChange({ receiptNumber: e.target.value })}
              aria-label="Receipt number"
            />
          </PageFilterField>

          <PageFilterField label="Class" hideLabel className="transport-toolbar-select">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.classId}
              onChange={(e) => onFiltersChange({ classId: e.target.value, sectionId: '' })}
              aria-label="Class"
            >
              <option value="">Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterField label="Mode" hideLabel className="transport-toolbar-select">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.paymentMode}
              onChange={(e) => onFiltersChange({ paymentMode: e.target.value })}
              aria-label="Payment mode"
            >
              <option value="">Mode</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterField label="Route" hideLabel className="transport-toolbar-select-wide">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.routeId}
              onChange={(e) => onFiltersChange({ routeId: e.target.value })}
              aria-label="Route"
            >
              <option value="">Route</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.route_name}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterField label="Vehicle" hideLabel className="transport-toolbar-select-wide">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.vanId}
              onChange={(e) => onFiltersChange({ vanId: e.target.value })}
              aria-label="Vehicle"
            >
              <option value="">Van</option>
              {vans.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_number}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterField label="From" hideLabel className="transport-toolbar-date">
            <input
              type="date"
              className="input-field transport-filter-date w-full min-w-0"
              value={filters.dateFrom}
              min={dateMin}
              max={filters.dateTo || dateMax}
              onChange={(e) => onFiltersChange({ dateFrom: e.target.value })}
              aria-label="From date"
            />
          </PageFilterField>

          <PageFilterField label="To" hideLabel className="transport-toolbar-date">
            <input
              type="date"
              className="input-field transport-filter-date w-full min-w-0"
              value={filters.dateTo}
              min={filters.dateFrom || dateMin}
              max={dateMax}
              onChange={(e) => onFiltersChange({ dateTo: e.target.value })}
              aria-label="To date"
            />
          </PageFilterField>

          <PageFilterActions className="transport-toolbar-actions pb-0">
            {hasActiveFilters ? <PageFilterClearButton onClick={clearFilters} /> : null}
            <ExportMenu onExport={handleExport} isExporting={isExporting} recordCount={payments.length} size="sm" />
          </PageFilterActions>
        </div>
        {exportError ? (
          <p className="mt-1 text-[11px] text-red-200" role="alert">
            {exportError}
          </p>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 flex flex-col transport-payment-table overflow-hidden">
        <div
          ref={bodyScrollRef}
          className="transport-payment-table-scroll flex-1 min-h-0 overflow-x-hidden"
          onScroll={syncFooterScroll}
        >
          <table className="data-table data-table-fit transport-payment-grid transport-payment-grid-table w-full">
            <TransportPaymentColgroup />
            <thead className="sticky">
              <tr>
                {[
                  'Rcpt.',
                  'Date',
                  'Student',
                  'Route',
                  'Trip',
                  'Amount',
                  'Disc.',
                  'Coll.',
                  'Mode',
                  'By',
                  'Sts.',
                  'Act.',
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-6 text-[11px] text-white/60">
                    Loading payments…
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-6 text-[11px] text-white/60">
                    No payment records found for the selected filters.
                  </td>
                </tr>
              ) : (
                payments.map((row) => (
                  <tr key={row.id} className="transport-table-row hover:bg-white/[0.04]">
                    <td className="tp-col-receipt max-w-0">
                      <span className="tp-cell-text font-mono" title={row.receipt_number}>
                        {row.receipt_number}
                      </span>
                    </td>
                    <td className="tp-col-date max-w-0 whitespace-nowrap tabular-nums">
                      {formatPaymentDateDisplay(row.payment_date)}
                    </td>
                    <td className="tp-col-student max-w-0">
                      <span className="tp-cell-text" title={row.student_name}>
                        {row.student_name}
                      </span>
                    </td>
                    <td className="tp-col-route max-w-0">
                      <span className="tp-cell-text" title={row.route_name}>
                        {row.route_name}
                      </span>
                    </td>
                    <td className="tp-col-trip max-w-0">
                      <span className="tp-cell-text">{row.trip_selection || '—'}</span>
                    </td>
                    <td className="tp-col-amount tp-td-num">{formatMoney(row.amount)}</td>
                    <td className="tp-col-discount tp-td-num">{formatMoney(row.discount || 0)}</td>
                    <td className="tp-col-collected tp-td-num text-emerald-300 font-medium">
                      {formatMoney(row.final_amount)}
                    </td>
                    <td className="tp-col-mode max-w-0">
                      <span className="tp-cell-text">{row.payment_mode}</span>
                    </td>
                    <td className="tp-col-collector max-w-0">
                      <span className="tp-cell-text" title={row.collected_by_name || undefined}>
                        {row.collected_by_name || '—'}
                      </span>
                    </td>
                    <td className="tp-col-status">
                      <span className="transport-status-tag transport-status-tag--ok">{row.status}</span>
                    </td>
                    <td className="tp-col-actions">
                      <div className="flex items-center justify-center gap-px">
                        <button
                          type="button"
                          className="ta-action-transfer"
                          onClick={() => onView(row)}
                        >
                          View
                        </button>
                        {canReprint ? (
                          <button
                            type="button"
                            className="ta-action-remove"
                            onClick={() => window.print()}
                          >
                            Print
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && payments.length > 0 ? (
          <div ref={footerScrollRef} className="transport-table-summary shrink-0 overflow-x-hidden">
            <table className="data-table data-table-fit transport-payment-grid transport-payment-grid-table w-full">
              <TransportPaymentColgroup />
              <tbody>
                <tr>
                  <td colSpan={5} className="text-left font-medium text-white/80 text-[11px]">
                    Showing {payments.length} record{payments.length === 1 ? '' : 's'}
                    {hasActiveFilters ? ' (filtered)' : ''}
                  </td>
                  <td className="tp-col-amount tp-td-num tp-tfoot-num text-white">
                    {formatMoney(paymentTotals.amount)}
                  </td>
                  <td className="tp-col-discount tp-td-num tp-tfoot-num text-white/80">
                    {formatMoney(paymentTotals.discount)}
                  </td>
                  <td className="tp-col-collected tp-td-num tp-tfoot-num text-emerald-300">
                    {formatMoney(paymentTotals.collected)}
                  </td>
                  <td colSpan={4} className="transport-table-summary-spacer" />
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  )
}
