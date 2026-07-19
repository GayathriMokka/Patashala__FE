'use client'

import { useMemo, useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  AreaChart,
  ComposedChart,
  Line,
} from 'recharts'
import { formatMoney } from '@/lib/formatMoney'

type LedgerRow = Record<string, unknown>

type RevenueAnalytics = {
  total_revenue?: number
  total_outflow?: number
  net_revenue?: number
  pending_revenue?: number
  today_collections?: number
  refunded_amount?: number
  overdue_amount?: number
  collection_percentage?: number
}

type RevenueSummaryProps = {
  transactions: LedgerRow[]
  analytics: RevenueAnalytics
  isLoading?: boolean
  recordLabel?: string
}

const CHART_COLORS = [
  '#34d399',
  '#60a5fa',
  '#a78bfa',
  '#22d3ee',
  '#fbbf24',
  '#f472b6',
  '#fb923c',
  '#818cf8',
]

const MODULE_COLORS: Record<string, string> = {
  fees: '#60a5fa',
  transport: '#34d399',
  ex_payments: '#22d3ee',
  revenue: '#a78bfa',
  expenses: '#f87171',
  salaries: '#c084fc',
}

function parseAmount(value: unknown) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function truncateLabel(value: string, max = 22) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function moduleLabel(module: string) {
  const m = String(module || '').toLowerCase()
  if (m === 'fees') return 'Fees'
  if (m === 'transport') return 'Transport'
  if (m === 'ex_payments') return 'Other collections'
  if (m === 'expenses') return 'Expenses'
  if (m === 'salaries') return 'Salaries'
  if (m === 'revenue') return 'Manual revenue'
  return module || 'Other'
}

function isCollection(tx: LedgerRow) {
  const direction = String(tx.direction || '').toLowerCase()
  const status = String(tx.status || '').toLowerCase()
  const module = String(tx.module || '').toLowerCase()
  return !(direction === 'outflow' || status === 'refunded' || module.includes('refund'))
}

function isPayment(tx: LedgerRow) {
  const direction = String(tx.direction || '').toLowerCase()
  const module = String(tx.module || '').toLowerCase()
  return direction === 'outflow' && (module === 'expenses' || module === 'salaries')
}

function txDateKey(tx: LedgerRow) {
  const raw = tx.transaction_date || tx.date || tx.created_at
  if (!raw) return null
  const parsed = parseISO(String(raw).slice(0, 10))
  if (!isValid(parsed)) return null
  return format(parsed, 'yyyy-MM')
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: { fill?: string } }>
  label?: string
  valueFormatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="expenses-chart-tooltip">
      {label ? <p className="expenses-chart-tooltip-label">{label}</p> : null}
      {payload.map((item) => {
        const value = Number(item.value || 0)
        const color = item.color || item.payload?.fill || '#60a5fa'
        return (
          <p key={item.name} className="expenses-chart-tooltip-value">
            <span className="expenses-chart-tooltip-dot" style={{ background: color }} />
            {item.name}: {valueFormatter ? valueFormatter(value) : value}
          </p>
        )
      })}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent: 'emerald' | 'blue' | 'amber' | 'violet' | 'rose'
}) {
  return (
    <div className={`expenses-kpi-card expenses-kpi-${accent === 'rose' ? 'amber' : accent}`}>
      <p className="expenses-kpi-label">{label}</p>
      <p className="expenses-kpi-value">{value}</p>
      {sub ? <p className="expenses-kpi-sub">{sub}</p> : null}
    </div>
  )
}

export default function RevenueSummary({
  transactions,
  analytics,
  isLoading,
  recordLabel,
}: RevenueSummaryProps) {
  const [activeModuleIndex, setActiveModuleIndex] = useState<number | undefined>(undefined)

  const stats = useMemo(() => {
    const collections = transactions.filter(isCollection)
    const payments = transactions.filter(isPayment)

    const totalCollections = collections.reduce((sum, tx) => sum + parseAmount(tx.amount), 0)
    const totalPayments = payments.reduce((sum, tx) => sum + parseAmount(tx.amount), 0)
    const netProfit = totalCollections - totalPayments

    const byModule = new Map<string, { amount: number; count: number; moduleKey: string }>()
    const byPayment = new Map<string, { amount: number; count: number }>()
    const byClass = new Map<string, { amount: number; count: number }>()
    const byMonth = new Map<string, { collections: number; payments: number; sortKey: string }>()

    for (const tx of collections) {
      const amount = parseAmount(tx.amount)
      const moduleKey = String(tx.module || 'other').toLowerCase()
      const module = moduleLabel(moduleKey)
      const row = byModule.get(module) || { amount: 0, count: 0, moduleKey }
      row.amount += amount
      row.count += 1
      byModule.set(module, row)

      const payment = String(tx.payment_method || 'Unknown').trim() || 'Unknown'
      const payRow = byPayment.get(payment) || { amount: 0, count: 0 }
      payRow.amount += amount
      payRow.count += 1
      byPayment.set(payment, payRow)

      const className = String(tx.class_name || '').trim() || 'Unassigned'
      const classRow = byClass.get(className) || { amount: 0, count: 0 }
      classRow.amount += amount
      classRow.count += 1
      byClass.set(className, classRow)

      const monthKey = txDateKey(tx)
      if (monthKey) {
        const label = format(parseISO(`${monthKey}-01`), 'MMM yy')
        const monthRow = byMonth.get(label) || { collections: 0, payments: 0, sortKey: monthKey }
        monthRow.collections += amount
        byMonth.set(label, monthRow)
      }
    }

    for (const tx of payments) {
      const amount = parseAmount(tx.amount)
      const monthKey = txDateKey(tx)
      if (monthKey) {
        const label = format(parseISO(`${monthKey}-01`), 'MMM yy')
        const monthRow = byMonth.get(label) || { collections: 0, payments: 0, sortKey: monthKey }
        monthRow.payments += amount
        byMonth.set(label, monthRow)
      }
    }

    const moduleData = Array.from(byModule.entries())
      .map(([name, row]) => ({
        name,
        shortName: truncateLabel(name, 16),
        amount: row.amount,
        count: row.count,
        share: totalCollections > 0 ? (row.amount / totalCollections) * 100 : 0,
        moduleKey: row.moduleKey,
      }))
      .sort((a, b) => b.amount - a.amount)

    const paymentData = Array.from(byPayment.entries())
      .map(([name, row]) => ({
        name,
        shortName: truncateLabel(name, 14),
        amount: row.amount,
        count: row.count,
        share: totalCollections > 0 ? (row.amount / totalCollections) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    const classData = Array.from(byClass.entries())
      .map(([name, row]) => ({
        name,
        shortName: truncateLabel(name, 14),
        amount: row.amount,
        count: row.count,
      }))
      .sort((a, b) => b.amount - a.amount)

    const monthlyData = Array.from(byMonth.entries())
      .map(([month, row]) => ({
        month,
        collections: row.collections,
        payments: row.payments,
        net: row.collections - row.payments,
        sortKey: row.sortKey,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    const flowData = [
      { name: 'Collections', amount: totalCollections, fill: '#34d399' },
      { name: 'Payments', amount: totalPayments, fill: '#f87171' },
      { name: 'Net', amount: Math.max(netProfit, 0), fill: '#60a5fa' },
    ]

    const collectionRate = Number(analytics.collection_percentage || 0)
    const topModule = moduleData[0]
    const topClass = classData[0]

    return {
      totalCollections,
      totalPayments,
      netProfit,
      collectionRate,
      topModule,
      topClass,
      moduleData,
      paymentData,
      classData,
      monthlyData,
      flowData,
      collectionCount: collections.length,
      paymentCount: payments.length,
    }
  }, [transactions, analytics.collection_percentage])

  if (isLoading) {
    return (
      <div className="expenses-summary-shell revenue-summary-shell">
        <div className="expenses-summary-loading">Loading summary…</div>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="expenses-summary-shell revenue-summary-shell">
        <div className="expenses-summary-empty">
          <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p>No revenue data to summarize.</p>
          <p className="text-sm text-white/45">Adjust filters or record transactions to see charts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="expenses-summary-shell revenue-summary-shell">
      <div className="revenue-summary-hero glass-card-opaque px-3 py-2 mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-medium">Financial snapshot</p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {recordLabel || `${transactions.length} records`}
          </p>
        </div>
        <div className="revenue-collection-gauge" aria-label={`Collection rate ${stats.collectionRate.toFixed(0)}%`}>
          <svg viewBox="0 0 44 44" className="revenue-collection-gauge-ring">
            <circle cx="22" cy="22" r="18" className="revenue-collection-gauge-track" />
            <circle
              cx="22"
              cy="22"
              r="18"
              className="revenue-collection-gauge-fill"
              strokeDasharray={`${Math.min(stats.collectionRate, 100) * 1.13} 113`}
            />
          </svg>
          <div className="revenue-collection-gauge-label">
            <span className="text-[9px] uppercase text-white/45">Collected</span>
            <strong className="text-sm text-emerald-200">{stats.collectionRate.toFixed(0)}%</strong>
          </div>
        </div>
      </div>

      <div className="expenses-summary-kpis">
        <KpiCard
          label="Collections"
          value={formatMoney(stats.totalCollections)}
          sub={`${stats.collectionCount} inflow records`}
          accent="emerald"
        />
        <KpiCard
          label="Payments"
          value={formatMoney(stats.totalPayments)}
          sub={`${stats.paymentCount} expense & salary`}
          accent="rose"
        />
        <KpiCard
          label="Net position"
          value={formatMoney(stats.netProfit)}
          sub={stats.netProfit >= 0 ? 'Surplus' : 'Deficit'}
          accent="blue"
        />
        <KpiCard
          label="Overdue fees"
          value={formatMoney(Number(analytics.overdue_amount || 0))}
          sub={stats.topClass ? `Top class: ${truncateLabel(stats.topClass.name, 20)}` : '—'}
          accent="amber"
        />
      </div>

      <div className="expenses-summary-grid">
        <section className="expenses-chart-card">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Collection sources</h3>
              <p>Where money comes in</p>
            </div>
            <span className="expenses-chart-pill">{stats.moduleData.length} sources</span>
          </header>
          <div className="expenses-chart-body expenses-chart-body-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.moduleData}
                  dataKey="amount"
                  nameKey="shortName"
                  cx="50%"
                  cy="50%"
                  innerRadius="56%"
                  outerRadius="80%"
                  paddingAngle={2}
                  activeIndex={activeModuleIndex}
                  onMouseEnter={(_, index) => setActiveModuleIndex(index)}
                  onMouseLeave={() => setActiveModuleIndex(undefined)}
                >
                  {stats.moduleData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={MODULE_COLORS[entry.moduleKey] || CHART_COLORS[index % CHART_COLORS.length]}
                      stroke="rgba(0,0,0,0.12)"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v) =>
                        `${formatMoney(v)} (${stats.totalCollections > 0 ? ((v / stats.totalCollections) * 100).toFixed(1) : 0}%)`
                      }
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="expenses-donut-center" aria-hidden>
              <span className="expenses-donut-center-label">Inflow</span>
              <span className="expenses-donut-center-value">
                {formatMoney(stats.totalCollections, { compact: true })}
              </span>
            </div>
          </div>
          <ul className="expenses-chart-legend">
            {stats.moduleData.slice(0, 5).map((item, index) => (
              <li key={item.name}>
                <span
                  className="expenses-chart-legend-swatch"
                  style={{
                    background:
                      MODULE_COLORS[item.moduleKey] || CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
                <span className="expenses-chart-legend-name" title={item.name}>
                  {item.shortName}
                </span>
                <span className="expenses-chart-legend-value">{item.share.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="expenses-chart-card">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Cash flow</h3>
              <p>Collections vs payments</p>
            </div>
          </header>
          <div className="expenses-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.flowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                  width={52}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {stats.flowData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="expenses-status-chips">
            <div className="expenses-status-chip">
              <span className="expenses-chart-legend-swatch" style={{ background: '#34d399' }} />
              <span>Today</span>
              <strong>{formatMoney(Number(analytics.today_collections || 0), { compact: true })}</strong>
            </div>
            <div className="expenses-status-chip">
              <span className="expenses-chart-legend-swatch" style={{ background: '#fbbf24' }} />
              <span>Refunds</span>
              <strong>{formatMoney(Number(analytics.refunded_amount || 0), { compact: true })}</strong>
            </div>
            <div className="expenses-status-chip">
              <span className="expenses-chart-legend-swatch" style={{ background: '#a78bfa' }} />
              <span>Pending</span>
              <strong>{formatMoney(Number(analytics.pending_revenue || 0), { compact: true })}</strong>
            </div>
          </div>
        </section>

        <section className="expenses-chart-card expenses-chart-card-wide">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Monthly trend</h3>
              <p>Collections and payments over time</p>
            </div>
          </header>
          <div className="expenses-chart-body expenses-chart-body-trend">
            {stats.monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.monthlyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueCollFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                    width={52}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(v) => formatMoney(v)}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="collections"
                    name="Collections"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#revenueCollFill)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="payments"
                    name="Payments"
                    stroke="#f87171"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#fca5a5' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="expenses-chart-no-trend">No dated transactions for trend view.</div>
            )}
          </div>
        </section>

        <section className="expenses-chart-card">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Payment modes</h3>
              <p>How fees were collected</p>
            </div>
          </header>
          <div className="expenses-chart-body expenses-chart-body-rank">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.paymentData.slice(0, 6)}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={72}
                  tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />}
                />
                <Bar dataKey="amount" radius={[0, 5, 5, 0]} maxBarSize={16}>
                  {stats.paymentData.slice(0, 6).map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="expenses-chart-card">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Class collections</h3>
              <p>Top earning classes</p>
            </div>
            {stats.topClass ? (
              <span className="expenses-chart-pill" title={stats.topClass.name}>
                Lead: {truncateLabel(stats.topClass.name, 12)}
              </span>
            ) : null}
          </header>
          <div className="expenses-chart-body expenses-chart-body-rank">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.classData.slice(0, 8)}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={72}
                  tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />}
                />
                <Bar dataKey="amount" radius={[0, 5, 5, 0]} maxBarSize={16}>
                  {stats.classData.slice(0, 8).map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}
