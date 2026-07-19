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
} from 'recharts'
import { formatMoney } from '@/lib/formatMoney'

type ExpenseRow = {
  amount?: string | number | null
  category?: string | null
  status?: string | null
  expense_date?: string | null
}

type ExpensesSummaryProps = {
  expenses: ExpenseRow[]
  isLoading?: boolean
}

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#a855f7',
]

const STATUS_COLORS: Record<string, string> = {
  Paid: '#10b981',
  Approved: '#3b82f6',
  Pending: '#f59e0b',
  Rejected: '#ef4444',
}

function parseAmount(value: ExpenseRow['amount']) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function truncateLabel(value: string, max = 22) {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; payload?: { fill?: string } }>
  label?: string
  valueFormatter?: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const value = Number(item.value || 0)
  return (
    <div className="expenses-chart-tooltip">
      <p className="expenses-chart-tooltip-label">{label || item.name}</p>
      <p className="expenses-chart-tooltip-value">
        <span
          className="expenses-chart-tooltip-dot"
          style={{ background: item.payload?.fill || '#3b82f6' }}
        />
        {valueFormatter ? valueFormatter(value) : value}
      </p>
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
  accent: 'blue' | 'amber' | 'emerald' | 'violet'
}) {
  return (
    <div className={`expenses-kpi-card expenses-kpi-${accent}`}>
      <p className="expenses-kpi-label">{label}</p>
      <p className="expenses-kpi-value">{value}</p>
      {sub ? <p className="expenses-kpi-sub">{sub}</p> : null}
    </div>
  )
}

export default function ExpensesSummary({ expenses, isLoading }: ExpensesSummaryProps) {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | undefined>(undefined)

  const stats = useMemo(() => {
    const totalAmount = expenses.reduce((sum, e) => sum + parseAmount(e.amount), 0)
    const byStatus = new Map<string, { count: number; amount: number }>()
    const byCategory = new Map<string, { count: number; amount: number }>()
    const byMonth = new Map<string, { amount: number; count: number; sortKey: string }>()

    for (const expense of expenses) {
      const amount = parseAmount(expense.amount)
      const status = expense.status || 'Unknown'
      const category = expense.category?.trim() || 'Uncategorized'

      const statusRow = byStatus.get(status) || { count: 0, amount: 0 }
      statusRow.count += 1
      statusRow.amount += amount
      byStatus.set(status, statusRow)

      const categoryRow = byCategory.get(category) || { count: 0, amount: 0 }
      categoryRow.count += 1
      categoryRow.amount += amount
      byCategory.set(category, categoryRow)

      if (expense.expense_date) {
        const parsed = parseISO(expense.expense_date)
        if (isValid(parsed)) {
          const monthKey = format(parsed, 'MMM yyyy')
          const sortKey = format(parsed, 'yyyy-MM')
          const monthRow = byMonth.get(monthKey) || { amount: 0, count: 0, sortKey }
          monthRow.amount += amount
          monthRow.count += 1
          byMonth.set(monthKey, monthRow)
        }
      }
    }

    const categoryData = Array.from(byCategory.entries())
      .map(([name, row]) => ({
        name,
        shortName: truncateLabel(name),
        amount: row.amount,
        count: row.count,
        share: totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    const statusData = Array.from(byStatus.entries())
      .map(([name, row]) => ({
        name,
        amount: row.amount,
        count: row.count,
        share: totalAmount > 0 ? (row.amount / totalAmount) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    const monthlyData = Array.from(byMonth.entries())
      .map(([month, row]) => ({
        month,
        amount: row.amount,
        count: row.count,
        sortKey: row.sortKey,
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))

    const paid = byStatus.get('Paid')?.amount || 0
    const pending = byStatus.get('Pending')?.amount || 0
    const approved = byStatus.get('Approved')?.amount || 0
    const topCategory = categoryData[0]

    return {
      totalAmount,
      totalCount: expenses.length,
      paid,
      pending,
      approved,
      topCategory,
      categoryData,
      statusData,
      monthlyData,
    }
  }, [expenses])

  if (isLoading) {
    return (
      <div className="expenses-summary-shell">
        <div className="expenses-summary-loading">Loading summary…</div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="expenses-summary-shell">
        <div className="expenses-summary-empty">
          <svg className="w-10 h-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
          <p>No expense data to summarize.</p>
          <p className="text-sm text-white/45">Adjust filters or add expenses to see charts.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="expenses-summary-shell">
      <div className="expenses-summary-kpis">
        <KpiCard
          label="Total spend"
          value={formatMoney(stats.totalAmount)}
          sub={`${stats.totalCount} expense${stats.totalCount === 1 ? '' : 's'}`}
          accent="violet"
        />
        <KpiCard
          label="Paid"
          value={formatMoney(stats.paid)}
          sub={`${stats.statusData.find((s) => s.name === 'Paid')?.count || 0} records`}
          accent="emerald"
        />
        <KpiCard
          label="Pending approval"
          value={formatMoney(stats.pending)}
          sub={`${stats.statusData.find((s) => s.name === 'Pending')?.count || 0} awaiting`}
          accent="amber"
        />
        <KpiCard
          label="Top category"
          value={stats.topCategory ? formatMoney(stats.topCategory.amount) : formatMoney(0)}
          sub={stats.topCategory ? truncateLabel(stats.topCategory.name, 28) : '—'}
          accent="blue"
        />
      </div>

      <div className="expenses-summary-grid">
        <section className="expenses-chart-card">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Spend by category</h3>
              <p>Share of total amount</p>
            </div>
            <span className="expenses-chart-pill">{stats.categoryData.length} categories</span>
          </header>
          <div className="expenses-chart-body expenses-chart-body-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.categoryData}
                  dataKey="amount"
                  nameKey="shortName"
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={2}
                  activeIndex={activeCategoryIndex}
                  onMouseEnter={(_, index) => setActiveCategoryIndex(index)}
                  onMouseLeave={() => setActiveCategoryIndex(undefined)}
                >
                  {stats.categoryData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      stroke="rgba(0,0,0,0.15)"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip
                      valueFormatter={(v) => `${formatMoney(v)} (${((v / stats.totalAmount) * 100).toFixed(1)}%)`}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="expenses-donut-center" aria-hidden>
              <span className="expenses-donut-center-label">Total</span>
              <span className="expenses-donut-center-value">{formatMoney(stats.totalAmount, { compact: true })}</span>
            </div>
          </div>
          <ul className="expenses-chart-legend">
            {stats.categoryData.slice(0, 6).map((item, index) => (
              <li key={item.name}>
                <span
                  className="expenses-chart-legend-swatch"
                  style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="expenses-chart-legend-name" title={item.name}>
                  {truncateLabel(item.name, 26)}
                </span>
                <span className="expenses-chart-legend-value">{item.share.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="expenses-chart-card">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Status breakdown</h3>
              <p>Amount by workflow stage</p>
            </div>
          </header>
          <div className="expenses-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.statusData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={<ChartTooltip valueFormatter={(v) => formatMoney(v)} />}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {stats.statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="expenses-status-chips">
            {stats.statusData.map((item) => (
              <div key={item.name} className="expenses-status-chip">
                <span
                  className="expenses-chart-legend-swatch"
                  style={{ background: STATUS_COLORS[item.name] || '#64748b' }}
                />
                <span>{item.name}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="expenses-chart-card expenses-chart-card-wide">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Monthly trend</h3>
              <p>Spending over time</p>
            </div>
          </header>
          <div className="expenses-chart-body expenses-chart-body-trend">
            {stats.monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlyData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="expenseTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                    width={56}
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
                    dataKey="amount"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fill="url(#expenseTrendFill)"
                    dot={{ r: 3, fill: '#93c5fd', stroke: '#1e3a8a', strokeWidth: 1 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="expenses-chart-no-trend">No dated expenses for trend view.</div>
            )}
          </div>
        </section>

        <section className="expenses-chart-card expenses-chart-card-wide">
          <header className="expenses-chart-card-header">
            <div>
              <h3>Category ranking</h3>
              <p>Top spend categories</p>
            </div>
          </header>
          <div className="expenses-chart-body expenses-chart-body-rank">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.categoryData.slice(0, 8)}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v, { compact: true, symbol: false })}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={108}
                  tick={{ fill: 'rgba(255,255,255,0.65)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  content={
                    <ChartTooltip
                      valueFormatter={(v) => formatMoney(v)}
                    />
                  }
                />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {stats.categoryData.slice(0, 8).map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
