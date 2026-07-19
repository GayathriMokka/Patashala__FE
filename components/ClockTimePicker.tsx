'use client'

import clsx from 'clsx'
import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { type Time12hParts } from '@/lib/time12h'

type ClockMode = 'hour' | 'minute'

type ClockTimePickerProps = {
  parts: Time12hParts
  onChange: (parts: Time12hParts) => void
  onMinuteSelect?: (parts: Time12hParts) => void
}

const HOUR_LABELS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTE_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

function polarToPercent(index: number, total: number, radiusPercent = 38) {
  const angle = ((index / total) * 360 - 90) * (Math.PI / 180)
  return {
    left: `${50 + radiusPercent * Math.cos(angle)}%`,
    top: `${50 + radiusPercent * Math.sin(angle)}%`,
  }
}

function valueToAngle(mode: ClockMode, hour: string, minute: string) {
  if (mode === 'hour') {
    const h = parseInt(hour || '12', 10)
    return (h === 12 ? 0 : h) * 30
  }
  return parseInt(minute || '0', 10) * 6
}

function pointerToPatch(mode: ClockMode, clientX: number, clientY: number, rect: DOMRect) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  if (deg < 0) deg += 360

  if (mode === 'hour') {
    let h = Math.round(deg / 30) % 12
    if (h === 0) h = 12
    return { hour: String(h) } as Partial<Time12hParts>
  }

  const m = Math.round(deg / 6) % 60
  return { minute: String(m).padStart(2, '0') } as Partial<Time12hParts>
}

export default function ClockTimePicker({ parts, onChange, onMinuteSelect }: ClockTimePickerProps) {
  const faceRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<ClockMode>('hour')
  const partsRef = useRef(parts)
  partsRef.current = parts

  const handAngle = valueToAngle(mode, parts.hour || '12', parts.minute || '00')
  const labels = mode === 'hour' ? HOUR_LABELS : MINUTE_LABELS
  const tipRadius = 38
  const tipRad = (handAngle * Math.PI) / 180
  const tipLeft = 50 + tipRadius * Math.sin(tipRad)
  const tipTop = 50 - tipRadius * Math.cos(tipRad)

  const applyPatch = useCallback(
    (patch: Partial<Time12hParts>, nextMode?: ClockMode) => {
      const next: Time12hParts = {
        hour: patch.hour ?? (partsRef.current.hour || '12'),
        minute: patch.minute ?? (partsRef.current.minute || '00'),
        period: patch.period ?? partsRef.current.period,
      }
      onChange(next)
      if (nextMode) setMode(nextMode)
    },
    [onChange]
  )

  const handleFacePointer = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!faceRef.current) return
      const rect = faceRef.current.getBoundingClientRect()
      const patch = pointerToPatch(mode, e.clientX, e.clientY, rect)

      if (mode === 'hour' && patch.hour) {
        applyPatch({ hour: patch.hour, minute: partsRef.current.minute || '00' }, 'minute')
        return
      }

      if (mode === 'minute' && patch.minute) {
        const next: Time12hParts = {
          hour: partsRef.current.hour || '12',
          minute: patch.minute,
          period: partsRef.current.period,
        }
        onChange(next)
        onMinuteSelect?.(next)
      }
    },
    [applyPatch, mode, onMinuteSelect]
  )

  return (
    <div className="clock-picker">
      <div className="flex items-center justify-center gap-1 mb-3">
        <button
          type="button"
          onClick={() => setMode('hour')}
          className={clsx(
            'clock-picker-digit px-2 py-1 rounded-lg text-2xl sm:text-3xl font-semibold tabular-nums transition-all duration-200',
            mode === 'hour' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {(parts.hour || '12').padStart(2, '0')}
        </button>
        <span className="text-2xl sm:text-3xl font-light text-slate-400">:</span>
        <button
          type="button"
          onClick={() => setMode('minute')}
          className={clsx(
            'clock-picker-digit px-2 py-1 rounded-lg text-2xl sm:text-3xl font-semibold tabular-nums transition-all duration-200',
            mode === 'minute' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-500 hover:text-slate-800'
          )}
        >
          {(parts.minute || '00').padStart(2, '0')}
        </button>
      </div>

      <div className="flex justify-center gap-2 mb-4">
        {(['AM', 'PM'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPatch({ period: p })}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200',
              parts.period === p
                ? 'bg-blue-600 text-white shadow-md scale-105'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div
        ref={faceRef}
        className="clock-picker-face relative mx-auto touch-none select-none cursor-pointer"
        onPointerDown={handleFacePointer}
        role="slider"
        aria-label={mode === 'hour' ? 'Select hour' : 'Select minute'}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-50 via-white to-slate-100 border border-slate-200 shadow-inner" />

        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-0.5 h-[6%] bg-slate-300 origin-bottom pointer-events-none"
            style={{ transform: `translate(-50%, -100%) rotate(${i * 30}deg) translateY(-42%)` }}
          />
        ))}

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="clock-picker-hand absolute bottom-1/2 left-1/2 rounded-full bg-blue-500 origin-bottom shadow-sm"
            style={{
              width: '3px',
              height: '38%',
              transform: `translateX(-50%) rotate(${handAngle}deg)`,
            }}
          />
          <div
            className="clock-picker-hand-tip absolute w-7 h-7 sm:w-8 sm:h-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600 border-2 border-white shadow-lg transition-all duration-300 ease-out z-[5]"
            style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}
          />
          <div
            className="absolute rounded-full bg-blue-600 border-2 border-white shadow-md z-10"
            style={{ width: 10, height: 10 }}
          />
        </div>

        {labels.map((val, i) => {
          const pos = polarToPercent(i, labels.length)
          const isSelected =
            mode === 'hour'
              ? parseInt(parts.hour || '0', 10) === val
              : parseInt(parts.minute || '0', 10) === val

          return (
            <button
              key={`${mode}-${val}`}
              type="button"
              className={clsx(
                'clock-picker-number absolute -translate-x-1/2 -translate-y-1/2 z-20',
                'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center',
                'text-xs sm:text-sm font-semibold transition-all duration-200',
                isSelected
                  ? 'bg-blue-600 text-white scale-110 shadow-lg ring-4 ring-blue-200/80'
                  : 'text-slate-700 hover:bg-blue-50 hover:scale-105 active:scale-95'
              )}
              style={pos}
              onClick={(e) => {
                e.stopPropagation()
                if (mode === 'hour') {
                  applyPatch({ hour: String(val), minute: parts.minute || '00' }, 'minute')
                } else {
                  const next: Time12hParts = {
                    hour: parts.hour || '12',
                    minute: String(val).padStart(2, '0'),
                    period: parts.period,
                  }
                  onChange(next)
                  onMinuteSelect?.(next)
                }
              }}
            >
              {mode === 'hour' ? val : String(val).padStart(2, '0')}
            </button>
          )
        })}
      </div>

      <p className="text-center text-[10px] sm:text-xs text-slate-400 mt-3">
        {mode === 'hour' ? 'Select hour on the clock' : 'Select minute on the clock'}
      </p>
    </div>
  )
}
