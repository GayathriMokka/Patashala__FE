'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

export type FloatingAlign = 'start' | 'end'

type UseFloatingPanelOptions = {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  align?: FloatingAlign
  offset?: number
  minWidth?: number
}

export function useFloatingPanel({
  anchorRef,
  open,
  align = 'start',
  offset = 4,
  minWidth = 160,
}: UseFloatingPanelOptions) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const update = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight
    const width = Math.min(Math.max(rect.width, minWidth), viewportW - 16)

    let left = align === 'end' ? rect.right - width : rect.left
    left = Math.max(8, Math.min(left, viewportW - width - 8))

    const spaceBelow = viewportH - rect.bottom - offset
    const spaceAbove = rect.top - offset
    const desiredMin = 240
    const openUp = spaceBelow < desiredMin && spaceAbove > spaceBelow
    const panelMaxHeight = Math.max(140, openUp ? spaceAbove - 8 : spaceBelow - 8)

    if (openUp) {
      setStyle({
        position: 'fixed',
        left,
        width,
        bottom: viewportH - rect.top + offset,
        maxHeight: panelMaxHeight,
        zIndex: 25000,
        visibility: 'visible',
      })
    } else {
      setStyle({
        position: 'fixed',
        top: rect.bottom + offset,
        left,
        width,
        maxHeight: panelMaxHeight,
        zIndex: 25000,
        visibility: 'visible',
      })
    }
  }, [anchorRef, align, offset, minWidth])

  useLayoutEffect(() => {
    if (!open) {
      setStyle({ visibility: 'hidden' })
      return
    }
    update()
  }, [open, update])

  useEffect(() => {
    if (!open) return
    const onReposition = () => update()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, update])

  return style
}

export function useClickOutside(
  refs: Array<RefObject<HTMLElement | null>>,
  onClose: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      const inside = refs.some((ref) => ref.current?.contains(target))
      if (!inside) onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
    // refs are stable RefObjects — intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onClose])
}
