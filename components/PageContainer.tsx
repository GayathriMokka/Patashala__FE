import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  /** Lock to viewport height with internal scroll (list-heavy pages) */
  viewport?: boolean
  /** Fill main column height; inner regions scroll (no page-level scroll) */
  fill?: boolean
}

export default function PageContainer({
  children,
  className = '',
  viewport = false,
  fill = false,
}: Props) {
  if (viewport) {
    return (
      <div
        className={`flex flex-col page-container-viewport overflow-hidden w-full min-w-0 max-w-[var(--app-content-max)] mx-auto ${className}`}
      >
        {children}
      </div>
    )
  }

  if (fill) {
    return (
      <div
        className={`flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden w-full max-w-[var(--app-content-max)] mx-auto ${className}`}
      >
        {children}
      </div>
    )
  }

  return <div className={`page-container ${className}`}>{children}</div>
}
