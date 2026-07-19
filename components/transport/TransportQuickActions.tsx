'use client'

import Link from 'next/link'

type Action = {
  label: string
  onClick?: () => void
  href?: string
  disabled?: boolean
}

export default function TransportQuickActions({ actions }: { actions: Action[] }) {
  return (
    <div className="glass-card p-4 space-y-2">
      <h3 className="section-title text-sm mb-3">Quick Actions</h3>
      <div className="flex flex-col gap-2">
        {actions.map((action) =>
          action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className="btn-secondary w-full text-center px-3 py-2 text-sm"
            >
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="btn-primary w-full px-3 py-2 text-sm disabled:opacity-50"
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
