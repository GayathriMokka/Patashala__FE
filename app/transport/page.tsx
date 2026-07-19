'use client'

import Layout from '@/components/Layout'
import StudentAssignmentTab from '@/components/transport/StudentAssignmentTab'
import PaymentHistoryTab from '@/components/transport/PaymentHistoryTab'
import VehicleInformationTab from '@/components/transport/VehicleInformationTab'
import AssignStudentModal from '@/components/transport/AssignStudentModal'
import TransportPaymentModal from '@/components/transport/TransportPaymentModal'
import { useAuth } from '@/contexts/AuthContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { canManageTransport, canViewTransport } from '@/lib/transportAccess'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { useUrlQueryState } from '@/lib/useUrlQueryState'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { getApiUrl } from '@/lib/api'
import { invalidateFinanceQueries } from '@/lib/invalidateFinanceQueries'
import { formatMoney } from '@/lib/formatMoney'
import {
  getAcademicYearDateBounds,
  getDefaultAcademicYearDateRange,
} from '@/lib/academicYearDates'
import {
  TRANSPORT_TABS,
  type TransportTab,
  type TransportAssignment,
  type TransportDashboard,
  type TransportMapping,
  type VehicleSummary,
  type TransportPayment,
} from '@/lib/transportTypes'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { useState, useEffect } from 'react'

export default function TransportPage() {
  const { user, token } = useAuth()
  const { hasFeature } = useSchoolFeatures()
  const { canAccess, accessLoading } = useRequirePageAccess('/transport')
  const {
    branchScopeKey,
    scopedHeaders: headers,
    academicYear,
  } = useBranchYearScope()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useUrlQueryState(
    'tab',
    [...TRANSPORT_TABS],
    'assignment'
  ) as [TransportTab, (tab: TransportTab) => void]

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [payAssignment, setPayAssignment] = useState<TransportAssignment | null>(null)
  const [successMessage, setSuccessMessage] = useState('')

  const [assignFilters, setAssignFilters] = useState({
    search: '',
    classId: '',
    sectionId: '',
    routeId: '',
    tripSelection: '',
    vanId: '',
    feeStatus: '',
  })

  const [payFilters, setPayFilters] = useState({
    search: '',
    classId: '',
    sectionId: '',
    routeId: '',
    tripSelection: '',
    vanId: '',
    paymentMode: '',
    dateFrom: '',
    dateTo: '',
    receiptNumber: '',
  })

  const roleName = user?.role_name
  const isParent = roleName === 'Parent'
  const legacyManage = canManageTransport(roleName)
  const legacyView = canViewTransport(roleName)

  const canAssign = legacyManage || hasFeature('transport.assign_students') || hasFeature('transport.create')
  const canCollect = legacyManage || hasFeature('transport.fee_collection')
  const canEdit = legacyManage || hasFeature('transport.edit')
  const canViewPayments = legacyManage || hasFeature('transport.payment_history') || hasFeature('transport.view')
  const canTrack = legacyView || hasFeature('transport.live_tracking') || hasFeature('transport.vehicle_tracking')
  const canReprint = hasFeature('transport.receipt_reprint') || legacyManage

  const schoolId = user?.school_id
  const API_URL = getApiUrl()
  const canFetch = !!token && !!schoolId && canAccess && legacyView
  const academicYearDateBounds = getAcademicYearDateBounds(academicYear)

  useEffect(() => {
    if (!academicYear?.id) return
    const { dateFrom, dateTo } = getDefaultAcademicYearDateRange(academicYear)
    setPayFilters((prev) => ({ ...prev, dateFrom, dateTo }))
  }, [academicYear?.id, academicYear?.start_date, academicYear?.end_date])

  const refreshAll = () => {
    queryClient.invalidateQueries(['transport-dashboard'])
    queryClient.invalidateQueries(['transport-assignments'])
    queryClient.invalidateQueries(['transport-payments'])
    queryClient.invalidateQueries(['transport-vehicles'])
    queryClient.invalidateQueries(['transport-mappings'])
    invalidateFinanceQueries(queryClient, schoolId)
  }

  const { data: dashboard, isLoading: dashboardLoading } = useQuery(
    ['transport-dashboard', schoolId, branchScopeKey],
    async () => (await axios.get(`${API_URL}/transport/dashboard`, { headers })).data.data as TransportDashboard,
    { enabled: canFetch && activeTab === 'payments' && canViewPayments, retry: 1 }
  )

  const { data: mappings = [], refetch: refetchMappings } = useQuery(
    ['transport-mappings', schoolId],
    async () => (await axios.get(`${API_URL}/transport/mappings`, { headers })).data.data as TransportMapping[],
    { enabled: canFetch && canAssign, retry: 1 }
  )

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery(
    ['transport-assignments', schoolId, branchScopeKey, assignFilters],
    async () => {
      const res = await axios.get(`${API_URL}/transport/assignments/students/enhanced`, {
        headers,
        params: {
          q: assignFilters.search || undefined,
          class_id: assignFilters.classId || undefined,
          section_id: assignFilters.sectionId || undefined,
          route_id: assignFilters.routeId || undefined,
          trip_selection: assignFilters.tripSelection || undefined,
          van_id: assignFilters.vanId || undefined,
          fee_status: assignFilters.feeStatus || undefined,
        },
      })
      return res.data.data as TransportAssignment[]
    },
    { enabled: canFetch && activeTab === 'assignment', retry: 1 }
  )

  const { data: payments = [], isLoading: paymentsLoading } = useQuery(
    ['transport-payments', schoolId, branchScopeKey, payFilters],
    async () => {
      const res = await axios.get(`${API_URL}/transport/payments`, {
        headers,
        params: {
          q: payFilters.search || undefined,
          class_id: payFilters.classId || undefined,
          section_id: payFilters.sectionId || undefined,
          route_id: payFilters.routeId || undefined,
          trip_selection: payFilters.tripSelection || undefined,
          van_id: payFilters.vanId || undefined,
          payment_mode: payFilters.paymentMode || undefined,
          receipt_number: payFilters.receiptNumber || undefined,
          date_from: payFilters.dateFrom || undefined,
          date_to: payFilters.dateTo || undefined,
        },
      })
      return res.data.data as TransportPayment[]
    },
    { enabled: canFetch && activeTab === 'payments' && canViewPayments, retry: 1 }
  )

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery(
    ['transport-vehicles', schoolId],
    async () => (await axios.get(`${API_URL}/transport/vans/summary`, { headers })).data.data as VehicleSummary[],
    { enabled: canFetch && activeTab === 'vehicles', retry: 1 }
  )

  const { data: classes = [] } = useQuery(
    ['transport-classes', schoolId, branchScopeKey],
    async () => (await axios.get(`${API_URL}/classes`, { headers, params: { school_id: schoolId } })).data.data,
    { enabled: canFetch, retry: 1 }
  )

  const { data: sections = [] } = useQuery(
    ['transport-sections', schoolId, branchScopeKey],
    async () => (await axios.get(`${API_URL}/sections`, { headers, params: { school_id: schoolId } })).data.data,
    { enabled: canFetch, retry: 1 }
  )

  const { data: routes = [] } = useQuery(
    ['transport-routes', schoolId],
    async () => (await axios.get(`${API_URL}/transport/routes`, { headers })).data.data,
    { enabled: canFetch, retry: 1 }
  )

  const { data: vans = [] } = useQuery(
    ['transport-vans-list', schoolId],
    async () => (await axios.get(`${API_URL}/transport/vans`, { headers })).data.data,
    { enabled: canFetch, retry: 1 }
  )

  const { data: activeTrackingTrips } = useQuery(
    ['transport-active-tracking', schoolId],
    async () => (await axios.get(`${API_URL}/transport/trips/active-tracking`, { headers })).data.data,
    { enabled: canFetch && isParent, retry: 1 }
  )

  const removeMutation = useMutation(
    async (id: number) =>
      axios.put(`${API_URL}/transport/assignments/students/${id}`, { is_active: false }, { headers }),
    { onSuccess: refreshAll }
  )

  if (accessLoading) {
    return (
      <Layout>
        <div className="page-container"><p className="meta-text">Loading…</p></div>
      </Layout>
    )
  }

  if (!canAccess && !legacyView) {
    return (
      <Layout>
        <div className="page-container">
          <div className="alert-error"><p className="text-sm">You do not have permission to access transport.</p></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div
        className={
          isParent
            ? 'page-container space-y-4'
            : 'flex flex-col page-container-viewport overflow-hidden mx-auto w-full min-h-0 gap-2 transport-page-layout'
        }
        style={isParent ? undefined : { maxWidth: 'var(--app-content-max)' }}
      >
        {isParent && (
          <div>
            <h1 className="page-title">School Transport</h1>
            <p className="page-subtitle">View routes, assignments, and live tracking for your children.</p>
          </div>
        )}

        {successMessage && (
          <div className="glass-card p-3 border border-emerald-400/40 text-emerald-100 text-sm">
            {successMessage}
            <button type="button" className="ml-2 underline" onClick={() => setSuccessMessage('')}>Dismiss</button>
          </div>
        )}

        {isParent && (
          <div className="space-y-4">
            {activeTrackingTrips && activeTrackingTrips.length > 0 ? (
              <div className="glass-card-opaque p-5 border-l-4 border-l-emerald-400">
                <h2 className="section-title mb-3">Live Trip Tracking</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTrackingTrips.map((trip: Record<string, unknown>) => (
                    <div key={String(trip.id)} className="glass-card-sm p-4">
                      <p className="font-semibold text-white">{String(trip.vehicle_number)} – {String(trip.trip_type)}</p>
                      <p className="text-sm text-white/70">{String(trip.route_name)}</p>
                      <a href={`/transport/live/${trip.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex btn-primary px-4 py-2 text-sm">
                        Track Live Van
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-card p-4 text-sm text-white/70">No active trips right now.</div>
            )}
          </div>
        )}

        {!isParent && (
          <div className="table-shell transport-page-shell flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 transport-toolbar">
              <div className="transport-unified-toolbar-row">
                <div className="transport-toolbar-meta shrink-0">
                  <h1 className="text-sm font-semibold text-white leading-none">Transport</h1>
                  <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">
                    {activeTab === 'assignment'
                      ? `${assignments.length} assignment${assignments.length === 1 ? '' : 's'}`
                      : activeTab === 'payments'
                        ? `${payments.length} payment${payments.length === 1 ? '' : 's'}`
                        : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`}
                  </p>
                </div>

                <div className="transport-toolbar-divider" aria-hidden />

                <div
                  className="transport-tab-switch shrink-0 flex gap-0.5 p-0.5 rounded-md border border-white/10 bg-black/15"
                  role="tablist"
                >
                  {TRANSPORT_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap shrink-0 ${
                        activeTab === tab
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {tab === 'assignment' ? 'Assignments' : tab === 'payments' ? 'Payments' : 'Vehicles'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {activeTab === 'assignment' && (
              <StudentAssignmentTab
                assignments={assignments}
                loading={assignmentsLoading}
                filters={assignFilters}
                onFiltersChange={(patch) => setAssignFilters((p) => ({ ...p, ...patch }))}
                classes={classes}
                sections={sections}
                routes={routes}
                vans={vans}
                headers={headers}
                token={token || ''}
                canAssign={canAssign}
                canCollect={canCollect}
                canEdit={canEdit}
                onAssignClick={() => {
                  refetchMappings()
                  setShowAssignModal(true)
                }}
                onPay={setPayAssignment}
                onRemove={(row) => {
                  if (confirm(`Remove transport assignment for ${row.student_name}?`)) {
                    removeMutation.mutate(row.id)
                  }
                }}
                onTransfer={() => alert('Use Assign Student to create a new assignment after removing the current one, or contact admin for route transfer.')}
              />
            )}

            {activeTab === 'payments' && canViewPayments && (
              <PaymentHistoryTab
                payments={payments}
                loading={paymentsLoading}
                dashboard={dashboard}
                dashboardLoading={dashboardLoading}
                filters={payFilters}
                onFiltersChange={(patch) => setPayFilters((p) => ({ ...p, ...patch }))}
                classes={classes}
                sections={sections}
                routes={routes}
                vans={vans}
                headers={headers}
                token={token || ''}
                canReprint={canReprint}
                onView={(p) => alert(`Receipt ${p.receipt_number}\nAmount: ${formatMoney(p.final_amount)}\nStudent: ${p.student_name}`)}
                academicYear={academicYear}
                dateMin={academicYearDateBounds.min}
                dateMax={academicYearDateBounds.max}
              />
            )}

            {activeTab === 'vehicles' && (
              <VehicleInformationTab vehicles={vehicles} loading={vehiclesLoading} canTrack={canTrack} />
            )}
          </div>
        )}

        {canAssign && schoolId && (
          <AssignStudentModal
            open={showAssignModal}
            onClose={() => setShowAssignModal(false)}
            headers={headers}
            schoolId={schoolId}
            academicYearId={academicYear?.id}
            mappings={mappings}
            vans={vans}
            routes={routes}
            classes={classes}
            sections={sections}
            onSuccess={() => {
              refreshAll()
              setSuccessMessage('Student assigned to transport successfully.')
            }}
          />
        )}

        <TransportPaymentModal
          assignment={payAssignment}
          open={!!payAssignment}
          onClose={() => setPayAssignment(null)}
          headers={headers}
          onSuccess={(receipt) => {
            refreshAll()
            setSuccessMessage(`Payment collected. Receipt: ${receipt}`)
          }}
        />
      </div>
    </Layout>
  )
}
