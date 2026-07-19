'use client'

import clsx from 'clsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ClockTimePicker from '@/components/ClockTimePicker'
import { formatTime12h, parseTime24, toTime24, type Time12hParts } from '@/lib/time12h'

type Time12hFieldProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  selectClassName?: string
}

const DEFAULT_PARTS: Time12hParts = { hour: '9', minute: '00', period: 'AM' }

function partsFromValue(value: string): Time12hParts {
  return parseTime24(value) ?? { ...DEFAULT_PARTS }
}

export default function Time12hField({
  value,
  onChange,
  className = '',
  selectClassName = '',
}: Time12hFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [draft, setDraft] = useState<Time12hParts>(() => partsFromValue(value))
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 300, isMobile: false })

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) setDraft(partsFromValue(value))
  }, [value, open])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const isMobile = window.innerWidth < 640
    const panelWidth = isMobile ? Math.min(window.innerWidth - 24, 340) : 300
    const panelHeight = 420

    if (isMobile) {
      setCoords({
        top: window.innerHeight - panelHeight - 16,
        left: (window.innerWidth - panelWidth) / 2,
        width: panelWidth,
        isMobile: true,
      })
      return
    }

    const rect = trigger.getBoundingClientRect()
    let top = rect.bottom + 8
    let left = rect.left

    if (top + panelHeight > window.innerHeight - 12) {
      top = rect.top - panelHeight - 8
    }
    left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12))

    setCoords({ top, left, width: panelWidth, isMobile: false })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  const applyDraft = (parts: Time12hParts) => {
    if (parts.hour && parts.minute) {
      onChange(toTime24(parts))
    }
  }

  const handleOpen = () => {
    setDraft(partsFromValue(value))
    setOpen(true)
  }

  const handleDone = () => {
    applyDraft(draft)
    setOpen(false)
  }

  const display = value ? formatTime12h(value) : 'Select time'

  const pickerPanel = open && mounted ? (
    <>
      <div
        className="fixed inset-0 z-[200] bg-black/25 backdrop-blur-[2px] clock-picker-backdrop sm:bg-transparent sm:backdrop-blur-none"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        className={clsx(
          'clock-picker-panel fixed z-[201] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl',
          coords.isMobile && 'clock-picker-panel--mobile'
        )}
        style={{
          top: coords.isMobile ? undefined : coords.top,
          bottom: coords.isMobile ? 12 : undefined,
          left: coords.left,
          width: coords.width,
        }}
        role="dialog"
        aria-label="Time picker"
      >
        <ClockTimePicker
          key={open ? 'picker-open' : 'picker-closed'}
          parts={draft}
          onChange={setDraft}
          onMinuteSelect={(next) => {
            setDraft(next)
            applyDraft(next)
            setOpen(false)
          }}
        />
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  ) : null

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-lg transition-all duration-200',
          'border-slate-200 bg-white text-slate-900 hover:border-blue-400 hover:ring-2 hover:ring-blue-100',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          !value && 'text-slate-400',
          selectClassName
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" strokeWidth={1.75} />
            <path strokeLinecap="round" strokeWidth={1.75} d="M12 7v5l3 2" />
          </svg>
          <span className="truncate font-medium tabular-nums">{display}</span>
        </span>
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {mounted && pickerPanel ? createPortal(pickerPanel, document.body) : null}
    </div>
  )
}
