'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  formatDateDDMMYYYY,
  normalizeDdMmYyyyInput,
  parseDDMMYYYYToISO,
  parsePaymentDateForInput,
} from '@/lib/paymentDates'

type DdMmYyyyDateFieldProps = {
  /** ISO date YYYY-MM-DD */
  value: string
  onChange: (iso: string) => void
  id?: string
  className?: string
  inputClassName?: string
  required?: boolean
  disabled?: boolean
  onInvalid?: (message: string) => void
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export default function DdMmYyyyDateField({
  value,
  onChange,
  id,
  className = '',
  inputClassName = 'input-field placeholder-slate-400 pr-11',
  required = false,
  disabled = false,
  onInvalid,
}: DdMmYyyyDateFieldProps) {
  const autoId = useId()
  const fieldId = id || `date-${autoId}`
  const pickerRef = useRef<HTMLInputElement>(null)
  const [display, setDisplay] = useState(() => formatDateDDMMYYYY(value))
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    if (!isEditing) {
      setDisplay(formatDateDDMMYYYY(value))
    }
  }, [value, isEditing])

  const commitDisplay = (text: string): boolean => {
    const iso = parseDDMMYYYYToISO(text)
    if (iso) {
      onChange(iso)
      setDisplay(formatDateDDMMYYYY(iso))
      return true
    }
    return false
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsEditing(true)
    const formatted = normalizeDdMmYyyyInput(e.target.value)
    setDisplay(formatted)

    if (formatted.length === 10) {
      const iso = parseDDMMYYYYToISO(formatted)
      if (iso) {
        onChange(iso)
      }
    }
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (!display.trim()) return

    if (!commitDisplay(display)) {
      onInvalid?.('Please enter a valid date in DD/MM/YYYY format')
      setDisplay(formatDateDDMMYYYY(value))
    }
  }

  const openPicker = () => {
    if (disabled) return
    const picker = pickerRef.current
    if (!picker) return

    picker.value = parsePaymentDateForInput(value)

    if (typeof picker.showPicker === 'function') {
      try {
        picker.showPicker()
        return
      } catch {
        // Fall through to click
      }
    }
    picker.click()
  }

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value
    if (!iso) return
    onChange(iso)
    setDisplay(formatDateDDMMYYYY(iso))
    setIsEditing(false)
  }

  return (
    <div className={`relative ${className}`}>
      <input
        id={fieldId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        value={display}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onFocus={() => setIsEditing(true)}
        className={inputClassName}
        required={required}
        disabled={disabled}
        maxLength={10}
        aria-describedby={`${fieldId}-hint`}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        aria-label="Open calendar to pick date"
        tabIndex={-1}
      >
        <CalendarIcon />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        value={parsePaymentDateForInput(value)}
        onChange={handlePickerChange}
      />
      <span id={`${fieldId}-hint`} className="sr-only">
        Enter date as day, month, year. Slashes are added automatically.
      </span>
    </div>
  )
}
