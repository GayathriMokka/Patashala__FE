'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import clsx from 'clsx'
import { DROPDOWN_PANEL_PORTAL_CLASS } from './dropdownStyles'
import { useFloatingPanel, type FloatingAlign } from '@/lib/useFloatingPanel'

type DropdownPanelPortalProps = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  panelRef?: RefObject<HTMLDivElement | null>
  align?: FloatingAlign
  minWidth?: number
  className?: string
  style?: CSSProperties
  role?: string
  'aria-multiselectable'?: boolean | 'true' | 'false'
  children: ReactNode
}

export default function DropdownPanelPortal({
  open,
  anchorRef,
  panelRef,
  align = 'start',
  minWidth,
  className,
  style,
  role,
  'aria-multiselectable': ariaMulti,
  children,
}: DropdownPanelPortalProps) {
  const [mounted, setMounted] = useState(false)
  const panelStyle = useFloatingPanel({ anchorRef, open, align, minWidth })

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!open || !mounted) return null

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-multiselectable={ariaMulti}
      style={{ ...panelStyle, ...style }}
      className={clsx(DROPDOWN_PANEL_PORTAL_CLASS, 'flex flex-col', className)}
    >
      {children}
    </div>,
    document.body
  )
}
