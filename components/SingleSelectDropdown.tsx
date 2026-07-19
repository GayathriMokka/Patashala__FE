'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import DropdownPanelPortal from './DropdownPanelPortal'
import {
  DROPDOWN_OPTION_CHECKED_CLASS,
  DROPDOWN_OPTION_ROW_CLASS,
  DROPDOWN_TRIGGER_CLASS,
} from './dropdownStyles'
import { useClickOutside } from '@/lib/useFloatingPanel'

export type SingleSelectOption = {
  value: string
  label: string
}

type SingleSelectDropdownProps = {
  id?: string
  options: SingleSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  compact?: boolean
  searchable?: boolean
  showCheckboxes?: boolean
  showPlaceholderOption?: boolean
  className?: string
  triggerClassName?: string
  'aria-label'?: string
}

export default function SingleSelectDropdown({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  compact = false,
  searchable = false,
  showCheckboxes = true,
  showPlaceholderOption = true,
  className,
  triggerClassName,
  'aria-label': ariaLabel,
}: SingleSelectDropdownProps) {
  const autoId = useId()
  const controlId = id || autoId
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedLabel = options.find((o) => o.value === value)?.label
  const displayLabel = selectedLabel || placeholder
  const showSearch = searchable && options.length > 4
  const triggerTokens = triggerClassName?.split(/\s+/) ?? []
  const isBranchHeaderTrigger = triggerTokens.includes('header-branch-select')
  const isHeaderTrigger = triggerTokens.some(
    (token) => token === 'header-academic-select' || token === 'header-branch-select'
  )

  const panelMinWidth = useMemo(() => {
    if (!isHeaderTrigger) return undefined

    const labels = [
      ...options.map((o) => o.label),
      ...(showPlaceholderOption ? [placeholder] : []),
    ]
    const longestChars = labels.reduce((max, label) => Math.max(max, label.length), 0)
    const estimated = Math.ceil(longestChars * 7.5) + 40

    return Math.min(Math.max(estimated, 220), 480)
  }, [isHeaderTrigger, options, placeholder, showPlaceholderOption])

  const optionLabelClass = isHeaderTrigger ? 'text-white/90 break-words' : 'text-white/90 truncate'

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useClickOutside([anchorRef, panelRef], () => {
    setOpen(false)
    setQuery('')
  }, open)

  useEffect(() => {
    if (open && showSearch) {
      searchRef.current?.focus()
    }
    if (!open) {
      setQuery('')
    }
  }, [open, showSearch])

  const pick = (optionValue: string) => {
    onChange(optionValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <div
      ref={anchorRef}
      className={clsx('relative', isBranchHeaderTrigger && 'w-max max-w-full', className)}
    >
      <button
        type="button"
        id={controlId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={isBranchHeaderTrigger ? displayLabel : undefined}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={clsx(
          !isHeaderTrigger && DROPDOWN_TRIGGER_CLASS,
          isHeaderTrigger && !isBranchHeaderTrigger && 'w-full text-left truncate',
          isBranchHeaderTrigger && 'w-full text-left whitespace-nowrap',
          compact && 'py-1 text-xs select-field-compact',
          triggerClassName,
          disabled && 'opacity-50 cursor-not-allowed',
          open && 'ring-2 ring-white/25 border-white/35'
        )}
      >
        <span
          className={clsx(
            'block',
            isBranchHeaderTrigger ? 'whitespace-nowrap' : 'truncate',
            !selectedLabel && 'text-white/55'
          )}
        >
          {displayLabel}
        </span>
      </button>

      <DropdownPanelPortal
        open={open && !disabled}
        anchorRef={anchorRef}
        panelRef={panelRef}
        minWidth={panelMinWidth}
        role="listbox"
      >
        {showSearch && (
          <div className="p-2 border-b border-white/10">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="input-field input-field-compact w-full text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false)
                  setQuery('')
                }
              }}
            />
          </div>
        )}

        <div
          className={clsx(
            'dropdown-options-scroll min-h-0 flex-1',
            compact && 'dropdown-options-scroll-compact',
            compact ? 'py-0.5' : 'py-1'
          )}
        >
          {showPlaceholderOption &&
            (showCheckboxes ? (
              <label
                role="option"
                aria-selected={value === ''}
                className={clsx(
                  DROPDOWN_OPTION_ROW_CLASS,
                  value === '' && DROPDOWN_OPTION_CHECKED_CLASS,
                  compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
                )}
              >
                <input
                  type="checkbox"
                  checked={value === ''}
                  onChange={() => pick('')}
                  className="multi-select-checkbox shrink-0"
                />
                <span className={optionLabelClass}>{placeholder}</span>
              </label>
            ) : (
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onClick={() => pick('')}
                className={clsx(
                  DROPDOWN_OPTION_ROW_CLASS,
                  value === '' && DROPDOWN_OPTION_CHECKED_CLASS,
                  'w-full border-0 bg-transparent text-left',
                  compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
                )}
              >
                <span className={clsx(optionLabelClass, value === '' && 'text-white font-medium')}>
                  {placeholder}
                </span>
              </button>
            ))}

          {filteredOptions.length === 0 ? (
            <p className={clsx('px-3 text-white/45', compact ? 'py-1.5 text-xs' : 'py-2 text-sm')}>
              No matches
            </p>
          ) : (
            filteredOptions.map((option) => {
              const selected = value === option.value
              if (showCheckboxes) {
                return (
                  <label
                    key={option.value}
                    role="option"
                    aria-selected={selected}
                    className={clsx(
                      DROPDOWN_OPTION_ROW_CLASS,
                      selected && DROPDOWN_OPTION_CHECKED_CLASS,
                      compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => pick(option.value)}
                      className="multi-select-checkbox shrink-0"
                    />
                    <span className={optionLabelClass}>{option.label}</span>
                  </label>
                )
              }

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(option.value)}
                  className={clsx(
                    DROPDOWN_OPTION_ROW_CLASS,
                    selected && DROPDOWN_OPTION_CHECKED_CLASS,
                    'w-full border-0 bg-transparent text-left',
                    compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
                  )}
                >
                  <span className={clsx(optionLabelClass, selected && 'text-white font-medium')}>
                    {option.label}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </DropdownPanelPortal>
    </div>
  )
}
