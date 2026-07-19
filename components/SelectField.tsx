'use client'

import {
  Children,
  forwardRef,
  isValidElement,
  useImperativeHandle,
  useMemo,
  useRef,
  type ChangeEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import clsx from 'clsx'
import SingleSelectDropdown, { type SingleSelectOption } from './SingleSelectDropdown'

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  searchable?: boolean
  showCheckboxes?: boolean
  showPlaceholderOption?: boolean
}

type ParsedSelect = {
  placeholder: string
  options: SingleSelectOption[]
}

function optionLabel(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children).trim()
  if (Array.isArray(children)) return children.map(optionLabel).join('').trim()
  return String(children).trim()
}

function walkSelectChildren(
  children: ReactNode,
  options: SingleSelectOption[],
  onPlaceholder: (label: string) => void
) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return

    if (child.type === 'option') {
      const props = child.props as {
        value?: string | number
        children?: ReactNode
        disabled?: boolean
        hidden?: boolean
      }
      if (props.hidden) return

      const value = String(props.value ?? '')
      const label = optionLabel(props.children) || value

      if (value === '') {
        onPlaceholder(label || 'Select…')
        return
      }

      if (props.disabled) return

      options.push({ value, label })
      return
    }

    if (child.type === 'optgroup') {
      const groupLabel = String((child.props as { label?: string }).label || '').trim()
      walkSelectChildren((child.props as { children?: ReactNode }).children, options, (label) => {
        onPlaceholder(groupLabel ? `${groupLabel} — ${label}` : label)
      })
      return
    }

    const nested = (child.props as { children?: ReactNode }).children
    if (nested) {
      walkSelectChildren(nested, options, onPlaceholder)
    }
  })
}

function parseSelectChildren(children: ReactNode): ParsedSelect {
  const options: SingleSelectOption[] = []
  let placeholder = 'Select…'

  walkSelectChildren(children, options, (label) => {
    placeholder = label
  })

  return { placeholder, options }
}

const SELECT_FIELD_VISUAL_TOKENS = new Set([
  'select-field',
  'select-field-compact',
  'input-field',
  'input-field-compact',
])

/** Header toolbar dropdowns — styles belong on the trigger, not the wrapper */
const HEADER_TRIGGER_TOKENS = new Set(['header-academic-select', 'header-branch-select'])

function parseSelectFieldClassName(className?: string) {
  if (!className) {
    return { wrapperClassName: undefined, triggerClassName: undefined, compact: false }
  }

  const wrapperTokens: string[] = []
  const triggerTokens: string[] = []
  let compact = false

  for (const token of className.split(/\s+/).filter(Boolean)) {
    if (HEADER_TRIGGER_TOKENS.has(token)) {
      triggerTokens.push(token)
      continue
    }

    if (SELECT_FIELD_VISUAL_TOKENS.has(token)) {
      triggerTokens.push(token === 'input-field' ? 'select-field' : token)
      if (token === 'select-field-compact' || token === 'input-field-compact') {
        compact = true
      }
      continue
    }

    if (token === 'py-1' || token === 'text-xs') {
      triggerTokens.push(token)
      compact = true
      continue
    }

    wrapperTokens.push(token)
  }

  return {
    wrapperClassName: wrapperTokens.join(' ') || undefined,
    triggerClassName: triggerTokens.join(' ') || undefined,
    compact,
  }
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  {
    children,
    className,
    value,
    defaultValue,
    onChange,
    disabled,
    id,
    name,
    required,
    multiple,
    size,
    searchable,
    showCheckboxes,
    showPlaceholderOption,
    ...rest
  },
  ref
) {
  const hiddenSelectRef = useRef<HTMLSelectElement>(null)
  const { placeholder, options } = useMemo(() => parseSelectChildren(children), [children])
  const { wrapperClassName, triggerClassName, compact } = useMemo(
    () => parseSelectFieldClassName(className),
    [className]
  )

  useImperativeHandle(ref, () => hiddenSelectRef.current as HTMLSelectElement)

  const useNative = Boolean(multiple) || (size != null && Number(size) > 1)

  const stringValue =
    value !== undefined && value !== null
      ? String(value)
      : defaultValue !== undefined && defaultValue !== null
        ? String(defaultValue)
        : ''

  const autoSearchable = searchable ?? options.length > 6

  const handleChange = (next: string) => {
    if (!onChange) return
    const synthetic = {
      target: {
        value: next,
        name: name ?? '',
        type: 'select-one',
      },
      currentTarget: {
        value: next,
        name: name ?? '',
      },
    } as ChangeEvent<HTMLSelectElement>
    onChange(synthetic)
  }

  if (useNative) {
    return (
      <select
        ref={hiddenSelectRef}
        id={id}
        name={name}
        className={className}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        required={required}
        multiple={multiple}
        size={size}
        {...rest}
      >
        {children}
      </select>
    )
  }

  return (
    <>
      <SingleSelectDropdown
        id={id}
        options={options}
        value={stringValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        compact={compact}
        searchable={autoSearchable}
        showCheckboxes={showCheckboxes}
        showPlaceholderOption={showPlaceholderOption}
        className={wrapperClassName}
        triggerClassName={triggerClassName}
        aria-label={rest['aria-label']}
      />
      {/* Hidden native select for form validation / ref compatibility */}
      <select
        ref={hiddenSelectRef}
        name={name}
        value={stringValue}
        required={required}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={() => {}}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </>
  )
})

export default SelectField
