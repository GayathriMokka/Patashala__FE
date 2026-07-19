'use client'

import type { TransportDashboard } from '@/lib/transportTypes'
import { formatMoney } from '@/lib/formatMoney'

const KPI_CONFIG = [
  { key: 'total_vehicles', label: 'Total Vehicles', tone: 'border-l-sky-400' },
  { key: 'total_routes', label: 'Total Routes', tone: 'border-l-violet-400' },
  { key: 'total_trips', label: 'Total Trips', tone: 'border-l-amber-400' },
  { key: 'total_assigned_students', label: 'Assigned Students', tone: 'border-l-emerald-400' },
  { key: 'monthly_revenue', label: 'Monthly Revenue', tone: 'border-l-teal-400', currency: true },
  { key: 'pending_payments', label: 'Pending Payments', tone: 'border-l-rose-400', currency: true },
  { key: 'collected_payments', label: 'Collected Payments', tone: 'border-l-green-400', currency: true },
  { key: 'active_vehicles', label: 'Active Vehicles', tone: 'border-l-blue-400' },
] as const

export default function TransportKpiStrip({
  metrics,
  loading,
}: {
  metrics?: TransportDashboard | null
  loading?: boolean
}) {
  return (
    <div className="shrink-0 border-b border-white/10 bg-black/10 overflow-x-auto">
      <div className="flex divide-x divide-white/10 min-w-max">
        {KPI_CONFIG.map((item) => {
          const raw = metrics?.[item.key as keyof TransportDashboard] ?? 0
          const value = item.currency ? formatMoney(raw, { compact: true }) : String(raw)
          return (
            <div key={item.key} className={`min-w-[5.5rem] px-2 py-1.5 border-l-2 ${item.tone}`}>
              <p className="text-[9px] font-semibold text-white/55 uppercase tracking-wide truncate">
                {item.label}
              </p>
              <p className="text-sm font-semibold text-white mt-0.5 tabular-nums truncate leading-tight">
                {loading ? '…' : value}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
