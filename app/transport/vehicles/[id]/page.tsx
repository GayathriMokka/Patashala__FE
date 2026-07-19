'use client'

import Layout from '@/components/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { useBranchYearScope } from '@/lib/useBranchYearScope'
import { useRequirePageAccess } from '@/lib/usePageAccess'
import { getApiUrl } from '@/lib/api'
import { useQuery } from 'react-query'
import axios from 'axios'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function VehicleDetailsPage() {
  const params = useParams()
  const vanId = params?.id as string
  const { token } = useAuth()
  const { scopedHeaders: headers } = useBranchYearScope()
  const { canAccess, accessLoading } = useRequirePageAccess('/transport')
  const API_URL = getApiUrl()

  const { data, isLoading, error } = useQuery(
    ['transport-van-details', vanId],
    async () => (await axios.get(`${API_URL}/transport/vans/${vanId}/details`, { headers })).data.data,
    { enabled: !!token && !!vanId && canAccess, retry: 1 }
  )

  if (accessLoading || isLoading) {
    return (
      <Layout>
        <div className="page-container"><p className="meta-text">Loading vehicle details…</p></div>
      </Layout>
    )
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="page-container"><div className="alert-error text-sm">Access denied.</div></div>
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="page-container">
          <Link href="/transport?tab=vehicles" className="text-sm text-primary-300 hover:underline">← Back to vehicles</Link>
          <p className="mt-4 text-red-200 text-sm">Vehicle not found.</p>
        </div>
      </Layout>
    )
  }

  const { vehicle, routes, students, student_summary, active_trip } = data

  return (
    <Layout>
      <div className="page-container space-y-6">
        <div>
          <Link href="/transport?tab=vehicles" className="text-sm text-primary-300 hover:underline">← Back to vehicles</Link>
          <h1 className="page-title mt-2">{vehicle.vehicle_number}</h1>
          <p className="page-subtitle">{vehicle.vehicle_name || vehicle.make_model || 'Vehicle profile'}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-4 space-y-2 text-sm">
            <h2 className="section-title text-base mb-2">Vehicle Profile</h2>
            <p><span className="text-white/60">Registration:</span> {vehicle.registration_number || '—'}</p>
            <p><span className="text-white/60">Insurance Expiry:</span> {vehicle.insurance_expiry ? new Date(vehicle.insurance_expiry).toLocaleDateString('en-IN') : '—'}</p>
            <p><span className="text-white/60">Permit Expiry:</span> {vehicle.permit_expiry ? new Date(vehicle.permit_expiry).toLocaleDateString('en-IN') : '—'}</p>
            <p><span className="text-white/60">Pollution Certificate:</span> {vehicle.pollution_expiry ? new Date(vehicle.pollution_expiry).toLocaleDateString('en-IN') : '—'}</p>
            <p><span className="text-white/60">Capacity:</span> {vehicle.capacity} · Occupied: {vehicle.occupied_seats} · Available: {vehicle.available_seats}</p>
          </div>

          <div className="glass-card p-4 space-y-2 text-sm">
            <h2 className="section-title text-base mb-2">Driver & Emergency</h2>
            <p><span className="text-white/60">Driver:</span> {vehicle.driver_name || '—'}</p>
            <p><span className="text-white/60">Mobile:</span> {vehicle.driver_mobile || '—'}</p>
            <p><span className="text-white/60">License:</span> {vehicle.license_number || '—'}</p>
            <p><span className="text-white/60">Attendant:</span> {vehicle.attendant_name || '—'} {vehicle.attendant_mobile ? `(${vehicle.attendant_mobile})` : ''}</p>
            <p><span className="text-white/60">Emergency:</span> {vehicle.emergency_contact || '—'} {vehicle.emergency_mobile ? `(${vehicle.emergency_mobile})` : ''}</p>
          </div>
        </div>

        <div className="glass-card p-4">
          <h2 className="section-title text-base mb-3">Assigned Routes</h2>
          {routes?.length ? (
            <ul className="space-y-2 text-sm">
              {routes.map((r: any) => (
                <li key={r.id} className="border border-white/10 rounded-lg px-3 py-2">
                  {r.route_name} ({r.route_code}) – {r.trip_type} · {r.stop_count} stops
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/60">No routes mapped to this vehicle.</p>
          )}
        </div>

        <div className="glass-card p-4">
          <h2 className="section-title text-base mb-3">Student Summary</h2>
          <div className="grid grid-cols-3 gap-3 text-sm mb-4">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{student_summary?.total || 0}</p>
              <p className="text-white/60 text-xs">Total</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{student_summary?.boys || 0}</p>
              <p className="text-white/60 text-xs">Boys</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-white">{student_summary?.girls || 0}</p>
              <p className="text-white/60 text-xs">Girls</p>
            </div>
          </div>
          {students?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60 border-b border-white/10">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">Class</th>
                    <th className="py-2">Section</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s: any) => (
                    <tr key={s.id} className="border-b border-white/5">
                      <td className="py-2 pr-4">{s.first_name} {s.last_name}</td>
                      <td className="py-2 pr-4">{s.class_name || '—'}</td>
                      <td className="py-2">{s.section_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {active_trip && (
          <div className="glass-card p-4 border-l-4 border-l-emerald-400">
            <h2 className="section-title text-base mb-2">Live Vehicle Tracking</h2>
            <p className="text-sm text-white/70 mb-3">
              {active_trip.route_name} – {active_trip.trip_type}
              {active_trip.start_time && ` · Started ${new Date(active_trip.start_time).toLocaleTimeString('en-IN')}`}
            </p>
            <a
              href={`/transport/live/${active_trip.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex px-4 py-2 text-sm"
            >
              Open Live Map
            </a>
          </div>
        )}
      </div>
    </Layout>
  )
}
