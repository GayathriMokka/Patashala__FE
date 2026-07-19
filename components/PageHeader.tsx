import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  meta?: string
  actions?: ReactNode
  compact?: boolean
}

export default function PageHeader({ title, subtitle, meta, actions, compact = false }: Props) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${compact ? 'pb-2' : 'pb-1'}`}
    >
      <div className="min-w-0">
        <h1 className={compact ? 'text-lg sm:text-xl font-bold text-white tracking-tight' : 'page-title'}>
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {meta && (
          <p className="text-xs text-white/60 mt-1 line-clamp-1">{meta}</p>
        )}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}
