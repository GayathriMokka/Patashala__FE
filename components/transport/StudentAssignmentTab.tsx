'use client'

import SelectField from '@/components/SelectField'
import ExportMenu from '@/components/ExportMenu'
import {
  PageFilterActions,
  PageFilterClearButton,
  PageFilterField,
  PageFilterSearch,
} from '@/components/PageFilters'
import { useMemo, useRef } from 'react'
import { usePageExport } from '@/lib/usePageExport'
import type { TransportAssignment } from '@/lib/transportTypes'
import { FEE_STATUSES, TRIP_SELECTIONS } from '@/lib/transportTypes'
import { formatMoney } from '@/lib/formatMoney'

function TransportAssignmentColgroup() {
  return (
    <colgroup>
      <col className="ta-col-student" />
      <col className="ta-col-class" />
      <col className="ta-col-route" />
      <col className="ta-col-trip" />
      <col className="ta-col-van" />
      <col className="ta-col-type" />
      <col className="ta-col-fee" />
      <col className="ta-col-paid" />
      <col className="ta-col-due" />
      <col className="ta-col-status" />
      <col className="ta-col-date" />
      <col className="ta-col-actions" />
    </colgroup>
  )
}

const compactSelect = 'select-field w-full min-w-0'

function formatAdmissionDisplay(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
}

type Filters = {
  search: string
  classId: string
  sectionId: string
  routeId: string
  tripSelection: string
  vanId: string
  feeStatus: string
}

type Props = {
  assignments?: TransportAssignment[]
  loading?: boolean
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  classes: { id: number; name: string }[]
  sections: { id: number; name: string; class_id: number }[]
  routes: { id: number; route_name: string }[]
  vans: { id: number; vehicle_number: string }[]
  headers: Record<string, string>
  token: string
  canAssign: boolean
  canCollect: boolean
  canEdit: boolean
  onAssignClick: () => void
  onPay: (row: TransportAssignment) => void
  onRemove: (row: TransportAssignment) => void
  onTransfer: (row: TransportAssignment) => void
}

function statusBadge(status: string) {
  if (status === 'Paid') return 'badge-success'
  if (status === 'Partial') return 'badge-warning'
  return 'badge-danger'
}

export default function StudentAssignmentTab({
  assignments = [],
  loading,
  filters,
  onFiltersChange,
  classes,
  sections,
  routes,
  vans,
  headers,
  token,
  canAssign,
  canCollect,
  canEdit,
  onAssignClick,
  onPay,
  onRemove,
  onTransfer,
}: Props) {
  const bodyScrollRef = useRef<HTMLDivElement>(null)
  const footerScrollRef = useRef<HTMLDivElement>(null)

  const syncFooterScroll = () => {
    const body = bodyScrollRef.current
    const footer = footerScrollRef.current
    if (body && footer) footer.scrollLeft = body.scrollLeft
  }

  const filteredSections = sections.filter((s) => !filters.classId || String(s.class_id) === filters.classId)

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.classId ||
      filters.sectionId ||
      filters.routeId ||
      filters.tripSelection ||
      filters.vanId ||
      filters.feeStatus
  )

  const clearFilters = () =>
    onFiltersChange({
      search: '',
      classId: '',
      sectionId: '',
      routeId: '',
      tripSelection: '',
      vanId: '',
      feeStatus: '',
    })

  const { isExporting, exportError, handleExport } = usePageExport({
    enabled: !!token,
    headers,
    config: {
      mode: 'data',
      title: 'Transport Student Assignments',
      filename: 'transport_assignments',
      columns: [
        { key: 'admission_number', label: 'Student ID' },
        { key: 'student_name', label: 'Student Name' },
        { key: 'class_name', label: 'Class' },
        { key: 'section_name', label: 'Section' },
        { key: 'route_name', label: 'Route' },
        { key: 'trip_selection', label: 'Trip' },
        { key: 'vehicle_number', label: 'Vehicle' },
        { key: 'fee_type', label: 'Fee Type' },
        { key: 'fee_amount', label: 'Fee Amount' },
        { key: 'paid_amount', label: 'Paid' },
        { key: 'pending_amount', label: 'Pending' },
        { key: 'fee_status', label: 'Status' },
        { key: 'assigned_at', label: 'Assigned Date' },
      ],
      getRows: () =>
        assignments.map((row) => ({
          ...row,
          assigned_at: row.assigned_at ? new Date(row.assigned_at).toLocaleDateString('en-IN') : '',
        })),
    },
  })

  const assignmentTotals = useMemo(
    () =>
      assignments.reduce(
        (acc, row) => ({
          fee: acc.fee + Number(row.fee_amount || 0),
          paid: acc.paid + Number(row.paid_amount || 0),
          due: acc.due + Number(row.pending_amount || 0),
        }),
        { fee: 0, paid: 0, due: 0 }
      ),
    [assignments]
  )

  return (
    <>
      <div className="shrink-0 px-2 sm:px-3 py-1.5 border-b border-white/10 transport-toolbar-filters">
        <div className="transport-unified-toolbar-row">
          <PageFilterSearch
            value={filters.search}
            onChange={(search) => onFiltersChange({ search })}
            placeholder="Student…"
            className="transport-toolbar-search"
            id="transport_assign_search"
          />

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

          <PageFilterField label="Section" hideLabel className="transport-toolbar-select">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.sectionId}
              onChange={(e) => onFiltersChange({ sectionId: e.target.value })}
              disabled={!filters.classId}
              aria-label="Section"
            >
              <option value="">Sec.</option>
              {filteredSections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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

          <PageFilterField label="Trip" hideLabel className="transport-toolbar-select">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.tripSelection}
              onChange={(e) => onFiltersChange({ tripSelection: e.target.value })}
              aria-label="Trip"
            >
              <option value="">Trip</option>
              {TRIP_SELECTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.slice(0, 3)}
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

          <PageFilterField label="Status" hideLabel className="transport-toolbar-select">
            <SelectField
              searchable={false}
              className={compactSelect}
              value={filters.feeStatus}
              onChange={(e) => onFiltersChange({ feeStatus: e.target.value })}
              aria-label="Status"
            >
              <option value="">Status</option>
              {FEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          </PageFilterField>

          <PageFilterActions className="transport-toolbar-actions pb-0">
            {hasActiveFilters ? <PageFilterClearButton onClick={clearFilters} /> : null}
            <ExportMenu onExport={handleExport} isExporting={isExporting} recordCount={assignments.length} size="sm" />
            {canAssign ? (
              <button type="button" onClick={onAssignClick} className="transport-toolbar-btn transport-toolbar-btn-primary">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Assign</span>
              </button>
            ) : null}
          </PageFilterActions>
        </div>
        {exportError ? (
          <p className="mt-1 text-[11px] text-red-200" role="alert">
            {exportError}
          </p>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 flex flex-col transport-assignment-table overflow-hidden">
        <div
          ref={bodyScrollRef}
          className="transport-assignment-table-scroll flex-1 min-h-0 overflow-x-hidden"
          onScroll={syncFooterScroll}
        >
          <table className="data-table data-table-fit transport-assignment-grid transport-assignment-grid-table">
            <TransportAssignmentColgroup />
            <thead className="sticky">
              <tr>
                {[
                  { label: 'Student', align: 'left' },
                  { label: 'Class', align: 'left' },
                  { label: 'Route', align: 'left' },
                  { label: 'Trip', align: 'left' },
                  { label: 'Van', align: 'left' },
                  { label: 'Typ.', align: 'left' },
                  { label: 'Fee', align: 'right' },
                  { label: 'Paid', align: 'right' },
                  { label: 'Due', align: 'right' },
                  { label: 'Sts.', align: 'center' },
                  { label: 'Date', align: 'left' },
                  { label: 'Act.', align: 'center' },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={col.align === 'right' ? 'ta-th-num' : col.align === 'center' ? 'ta-th-center' : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-6 text-[11px] text-white/60">
                    Loading assignments…
                  </td>
                </tr>
              ) : assignments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-6 text-[11px] text-white/60">
                    {hasActiveFilters
                      ? 'No records match your filters.'
                      : 'No student assignments yet. Assign students to transport routes.'}
                  </td>
                </tr>
              ) : (
                assignments.map((row) => (
                <tr key={row.id} className="transport-table-row hover:bg-white/[0.04]">
                  <td className="ta-col-student max-w-0">
                    <span
                      className="ta-cell-text font-medium text-white"
                      title={`${row.student_name}${row.admission_number ? ` · ${row.admission_number}` : ''}`}
                    >
                      {row.student_name}
                    </span>
                    <span className="ta-cell-sub font-mono" title={row.admission_number || ''}>
                      {formatAdmissionDisplay(row.admission_number) || '—'}
                    </span>
                  </td>
                  <td className="ta-col-class">
                    <span className="ta-cell-text" title={`${row.class_name || ''} ${row.section_name || ''}`}>
                      {row.class_name || '—'}
                      {row.section_name ? <span className="text-white/50"> · {row.section_name}</span> : null}
                    </span>
                  </td>
                  <td className="ta-col-route">
                    <span className="ta-cell-text" title={row.route_name}>{row.route_name}</span>
                  </td>
                  <td className="ta-col-trip">
                    {row.trip_selection ? (
                      <span className="ta-trip-badge">{row.trip_selection}</span>
                    ) : (
                      <span className="text-white/40">—</span>
                    )}
                  </td>
                  <td className="ta-col-van">
                    <span className="ta-cell-text font-mono" title={row.vehicle_number || ''}>{row.vehicle_number || '—'}</span>
                  </td>
                  <td className="ta-col-type">
                    <span className="ta-cell-text">{row.fee_type || '—'}</span>
                  </td>
                  <td className="ta-col-fee ta-td-num">{formatMoney(row.fee_amount)}</td>
                  <td className="ta-col-paid ta-td-num text-emerald-300">{formatMoney(row.paid_amount)}</td>
                  <td className="ta-col-due ta-td-num text-rose-300 font-medium">{formatMoney(row.pending_amount)}</td>
                  <td className="ta-col-status ta-td-center">
                    <span className={`${statusBadge(row.fee_status)} ta-status-badge`}>{row.fee_status}</span>
                  </td>
                  <td className="ta-col-date">
                    <span className="ta-cell-text tabular-nums">
                      {row.assigned_at ? new Date(row.assigned_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                    </span>
                  </td>
                  <td className="ta-col-actions ta-td-center">
                    <div className="ta-actions">
                      {canCollect && row.fee_status !== 'Paid' && (
                        <button type="button" className="ta-action-pay" onClick={() => onPay(row)}>Pay</button>
                      )}
                      {canEdit && (
                        <>
                          <button type="button" className="ta-action-transfer" onClick={() => onTransfer(row)}>Transfer</button>
                          <button type="button" className="ta-action-remove" onClick={() => onRemove(row)}>Remove</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && assignments.length > 0 ? (
          <div ref={footerScrollRef} className="transport-table-summary shrink-0 overflow-x-hidden">
            <table className="data-table data-table-fit transport-assignment-grid transport-assignment-grid-table">
              <TransportAssignmentColgroup />
              <tbody>
                <tr>
                  <td colSpan={6} className="text-left font-medium text-white/80 text-[11px]">
                    Showing {assignments.length} record{assignments.length === 1 ? '' : 's'}
                    {hasActiveFilters ? ' (filtered)' : ''}
                  </td>
                  <td className="ta-col-fee ta-td-num ta-tfoot-num text-white">
                    {formatMoney(assignmentTotals.fee)}
                  </td>
                  <td className="ta-col-paid ta-td-num ta-tfoot-num text-emerald-300">
                    {formatMoney(assignmentTotals.paid)}
                  </td>
                  <td className="ta-col-due ta-td-num ta-tfoot-num text-rose-300">
                    {formatMoney(assignmentTotals.due)}
                  </td>
                  <td colSpan={3} className="transport-table-summary-spacer" />
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  )
}
