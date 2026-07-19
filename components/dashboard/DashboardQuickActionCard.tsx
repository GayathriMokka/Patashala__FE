import Link from 'next/link'
import type { DashboardQuickActionDef } from '@/lib/dashboardConfig'

const ACTION_STYLES: Partial<
  Record<DashboardQuickActionDef['id'], { border: string; icon: string }>
> = {
  'add-student': { border: 'border-l-blue-400', icon: 'text-blue-200 bg-blue-500/25 border border-blue-400/30' },
  'mark-attendance': { border: 'border-l-emerald-400', icon: 'text-emerald-200 bg-emerald-500/25 border border-emerald-400/30' },
  'collect-fee': { border: 'border-l-amber-400', icon: 'text-amber-200 bg-amber-500/25 border border-amber-400/30' },
  reports: { border: 'border-l-violet-400', icon: 'text-violet-200 bg-violet-500/25 border border-violet-400/30' },
  leaves: { border: 'border-l-rose-400', icon: 'text-rose-200 bg-rose-500/25 border border-rose-400/30' },
  expenses: { border: 'border-l-orange-400', icon: 'text-orange-200 bg-orange-500/25 border border-orange-400/30' },
  salaries: { border: 'border-l-indigo-400', icon: 'text-indigo-200 bg-indigo-500/25 border border-indigo-400/30' },
  timetable: { border: 'border-l-cyan-400', icon: 'text-cyan-200 bg-cyan-500/25 border border-cyan-400/30' },
  exams: { border: 'border-l-fuchsia-400', icon: 'text-fuchsia-200 bg-fuchsia-500/25 border border-fuchsia-400/30' },
  transport: { border: 'border-l-teal-400', icon: 'text-teal-200 bg-teal-500/25 border border-teal-400/30' },
  'face-capture': { border: 'border-l-white/40', icon: 'text-white/80 bg-white/15 border border-white/25' },
}

const defaultStyle = {
  border: 'border-l-white/30',
  icon: 'text-white/70 bg-white/12 border border-white/20',
}

type Props = {
  action: DashboardQuickActionDef
}

export default function DashboardQuickActionCard({ action }: Props) {
  const style = ACTION_STYLES[action.id] || defaultStyle

  return (
    <Link
      href={action.href}
      className={`glass-card-sm p-3 border-l-4 ${style.border} bg-black/25 hover:bg-black/35 transition-all block group`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${style.icon} group-hover:scale-105 transition-transform`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-sm">{action.title}</h3>
          <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{action.description}</p>
        </div>
      </div>
    </Link>
  )
}
