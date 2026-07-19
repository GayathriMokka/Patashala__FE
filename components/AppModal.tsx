'use client'

import { createPortal } from 'react-dom'
import { useLayoutEffect } from 'react'
import { useMounted } from '@/lib/useMounted'
import { lockModalScroll, unlockModalScroll } from '@/lib/modalScrollLock'

interface AppModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  panelClassName?: string
  labelledBy?: string
  variant?: 'glass' | 'opaque'
}

/**
 * Full-screen modal rendered via portal — always above app header (z-60) and sidebar.
 * Background page scroll is locked; only .app-modal-body scrolls inside the panel.
 */
export default function AppModal({
  open,
  onClose: _onClose,
  children,
  panelClassName = '',
  labelledBy,
  variant = 'opaque',
}: AppModalProps) {
  const mounted = useMounted()

  useLayoutEffect(() => {
    if (!open) return
    lockModalScroll()
    return () => unlockModalScroll()
  }, [open])

  if (!open || !mounted) return null

  const panelBase = variant === 'opaque' ? 'app-modal-panel-opaque' : 'app-modal-panel'

  return createPortal(
    <div className="app-modal-overlay">
      <div
        className={`${panelBase} ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
