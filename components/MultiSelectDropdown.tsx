'use client'

import { useId, useRef, useState } from 'react'
import clsx from 'clsx'
import DropdownPanelPortal from './DropdownPanelPortal'
import {
  DROPDOWN_OPTION_CHECKED_CLASS,
  DROPDOWN_OPTION_ROW_CLASS,
  DROPDOWN_TRIGGER_CLASS,
} from './dropdownStyles'
import { useClickOutside } from '@/lib/useFloatingPanel'

export type MultiSelectOption = {
  value: string
  label: string
}

type MultiSelectDropdownProps = {
  id?: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  compact?: boolean
  className?: string
  showSelectAll?: boolean
  maxDisplayLabels?: number
  'aria-label'?: string
}

function buildDisplayLabel(
  selected: MultiSelectOption[],
  placeholder: string,
  maxDisplayLabels: number
) {
  if (selected.length === 0) return placeholder
  if (selected.length === 1) return selected[0].label
  if (selected.length <= maxDisplayLabels) {
    return selected.map((o) => o.label).join(', ')
  }
  return `${selected.length} selected`
}

export default function MultiSelectDropdown({
  id,
  options,
  value,
  onChange,
  placeholder = 'All',
  disabled = false,
  compact = false,
  className,
  showSelectAll = true,
  maxDisplayLabels = 2,
  'aria-label': ariaLabel,
}: MultiSelectDropdownProps) {
  const autoId = useId()
  const controlId = id || autoId
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const selectedOptions = options.filter((o) => value.includes(o.value))
  const allSelected = options.length > 0 && value.length === options.length
  const displayLabel = buildDisplayLabel(selectedOptions, placeholder, maxDisplayLabels)

  useClickOutside([anchorRef, panelRef], () => setOpen(false), open)

  const toggleValue = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const handleSelectAll = () => {
    if (allSelected) {
      onChange([])
    } else {
      onChange(options.map((o) => o.value))
    }
  }

  return (
    <div ref={anchorRef} className={clsx('relative', className)}>
      <button
        type="button"
        id={controlId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={clsx(
          DROPDOWN_TRIGGER_CLASS,
          compact && 'py-1 text-xs select-field-compact',
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'ring-2 ring-white/25 border-white/35'
        )}
      >
        <span className={clsx('block truncate', value.length === 0 && 'text-white/55')}>
          {displayLabel}
        </span>
      </button>

      <DropdownPanelPortal
        open={open && !disabled}
        anchorRef={anchorRef}
        panelRef={panelRef}
        role="listbox"
        aria-multiselectable="true"
      >
        {showSelectAll && options.length > 1 && (
          <label
            className={clsx(
              DROPDOWN_OPTION_ROW_CLASS,
              'border-b border-white/10',
              compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
            )}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="multi-select-checkbox shrink-0"
            />
            <span className="font-medium text-white/90">Select all</span>
          </label>
        )}

        <div
          className={clsx(
            'dropdown-options-scroll',
            compact && 'dropdown-options-scroll-compact',
            compact ? 'py-0.5' : 'py-1'
          )}
        >
          {options.length === 0 ? (
            <p className={clsx('px-3 text-white/45', compact ? 'py-1.5 text-xs' : 'py-2 text-sm')}>
              No options
            </p>
          ) : (
            options.map((option) => {
              const checked = value.includes(option.value)
              return (
                <label
                  key={option.value}
                  role="option"
                  aria-selected={checked}
                  className={clsx(
                    DROPDOWN_OPTION_ROW_CLASS,
                    checked && DROPDOWN_OPTION_CHECKED_CLASS,
                    compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option.value)}
                    className="multi-select-checkbox shrink-0"
                  />
                  <span className="text-white/90 truncate">{option.label}</span>
                </label>
              )
            })
          )}
        </div>
      </DropdownPanelPortal>
    </div>
  )
}
