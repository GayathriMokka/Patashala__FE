'use client'

import Link from 'next/link'
import type { VehicleSummary } from '@/lib/transportTypes'

export default function VehicleInformationTab({
  vehicles = [],
  loading,
  canTrack,
}: {
  vehicles?: VehicleSummary[]
  loading?: boolean
  canTrack?: boolean
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {loading ? (
        <p className="flex-1 flex items-center justify-center text-xs text-white/55">Loading vehicles…</p>
      ) : vehicles.length === 0 ? (
        <p className="flex-1 flex items-center justify-center text-xs text-white/55 py-8">
          No vehicles configured. Add vans from Master Data.
        </p>
      ) : (
        <>
          <div className="transport-vehicles-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 sm:p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {vehicles.map((v) => (
                <Link
                  key={v.id}
                  href={`/transport/vehicles/${v.id}`}
                  className="transport-vehicle-card block rounded-lg border border-white/10 bg-white/[0.04] p-2.5 hover:bg-white/[0.07] hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{v.vehicle_number}</p>
                      {v.vehicle_name ? (
                        <p className="text-[10px] text-white/55 truncate">{v.vehicle_name}</p>
                      ) : null}
                    </div>
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-px rounded ${v.is_active ? 'transport-status-tag transport-status-tag--ok' : 'transport-status-tag'}`}>
                      {v.vehicle_status}
                    </span>
                  </div>
                  <div className="mt-2 space-y-0.5 text-[10px] text-white/70 leading-snug">
                    <p className="truncate">Driver: {v.driver_name || '—'}</p>
                    <p className="truncate">Mob: {v.driver_mobile || '—'}</p>
                    <p className="tabular-nums">
                      Cap {v.capacity} · Occ {v.occupied_seats} · Avl {v.available_seats}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-px rounded ${
                        v.live_status === 'In Progress'
                          ? 'transport-status-tag transport-status-tag--live'
                          : 'transport-status-tag'
                      }`}
                    >
                      {v.live_status === 'In Progress' ? 'Live' : v.live_status || 'Idle'}
                    </span>
                    {canTrack && v.live_status === 'In Progress' ? (
                      <span className="text-[10px] text-primary-300 shrink-0">Track →</span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
            {vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}
          </div>
        </>
      )}
    </div>
  )
}
