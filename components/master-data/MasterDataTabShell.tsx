'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ShellProps = {
  title: string
  subtitle?: ReactNode
  toolbarActions?: ReactNode
  filters?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}

export function MasterDataToolbarBtn({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}) {
  const variantClass =
    variant === 'secondary'
      ? 'master-data-tab-toolbar-btn-secondary'
      : 'master-data-tab-toolbar-btn-primary'
  return (
    <button type="button" className={`master-data-tab-toolbar-btn ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function MasterDataToolbarLink({
  className = '',
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: 'secondary' }) {
  return (
    <a className={`master-data-tab-toolbar-btn master-data-tab-toolbar-btn-secondary ${className}`} {...props}>
      {children}
    </a>
  )
}

export function MasterDataDenseTable({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`master-data-tab-table-scroll overflow-x-hidden flex-1 min-h-0 ${className}`}>
      {children}
    </div>
  )
}

export function MasterDataStatusTag({
  active,
  label,
  tone = 'neutral',
}: {
  active?: boolean
  label: string
  tone?: 'neutral' | 'active' | 'locked' | 'warning'
}) {
  const toneClass =
    tone === 'active' || active
      ? 'master-data-status-tag--active'
      : tone === 'locked'
        ? 'master-data-status-tag--locked'
        : tone === 'warning'
          ? 'master-data-status-tag--warning'
          : ''
  return <span className={`master-data-status-tag ${toneClass}`}>{label}</span>
}

export default function MasterDataTabShell({
  title,
  subtitle,
  toolbarActions,
  filters,
  footer,
  children,
  className = '',
}: ShellProps) {
  return (
    <div className={`table-shell master-data-tab-shell flex-1 min-h-0 flex flex-col overflow-hidden ${className}`}>
      <div className="shrink-0 px-2 sm:px-3 py-2 border-b border-white/10 master-data-tab-toolbar">
        <div className="master-data-tab-unified-toolbar-row">
          <div className="master-data-tab-toolbar-meta shrink-0">
            <h2 className="text-sm font-semibold text-white leading-none">{title}</h2>
            {subtitle ? (
              <p className="text-[10px] text-white/50 mt-0.5 tabular-nums whitespace-nowrap">{subtitle}</p>
            ) : null}
          </div>
          {toolbarActions ? (
            <div className="master-data-tab-toolbar-actions ml-auto pl-1 border-l border-white/10 shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
              {toolbarActions}
            </div>
          ) : null}
        </div>
        {filters ? (
          <div className="master-data-tab-filters mt-1.5 pt-1.5 border-t border-white/[0.06]">
            <div className="master-data-tab-unified-toolbar-row">{filters}</div>
          </div>
        ) : null}
      </div>

      <div className="master-data-tab-body flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>

      {footer ? (
        <div className="shrink-0 px-3 py-1.5 border-t border-white/10 text-[11px] text-white/50 tabular-nums">
          {footer}
        </div>
      ) : null}
    </div>
  )
}
