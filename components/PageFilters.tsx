'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'

function SearchIcon() {
  return (
    <svg
      className="page-filter-search-icon absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/45 pointer-events-none"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  )
}

type PageFilterBarProps = {
  children: ReactNode
  className?: string
  error?: string | null
}

export function PageFilterBar({ children, className, error }: PageFilterBarProps) {
  return (
    <div className={clsx('page-filter-bar glass-card p-4 shrink-0', className)}>
      {children}
      {error ? (
        <p className="mt-2 text-xs text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type PageFilterRowProps = {
  children: ReactNode
  className?: string
}

export function PageFilterRow({ children, className }: PageFilterRowProps) {
  return (
    <div className={clsx('page-filter-row flex flex-col lg:flex-row gap-4 lg:items-end', className)}>
      {children}
    </div>
  )
}

type PageFilterSearchProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  hideLabel?: boolean
  className?: string
}

export function PageFilterSearch({
  id = 'page_search',
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  hideLabel = false,
  className,
}: PageFilterSearchProps) {
  return (
    <div className={clsx('page-filter-search flex-1 min-w-0', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'label-text'}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input-field pl-10"
        />
        <SearchIcon />
      </div>
    </div>
  )
}

export type PageFilterFieldWidth = 'default' | 'wide' | 'narrow' | 'auto'

const fieldWidthClasses: Record<PageFilterFieldWidth, string> = {
  default: 'w-full lg:w-44',
  wide: 'w-full lg:w-48',
  narrow: 'w-full lg:w-40',
  auto: 'w-full lg:w-auto lg:min-w-[14rem]',
}

type PageFilterFieldProps = {
  id?: string
  label: string
  children: ReactNode
  width?: PageFilterFieldWidth
  className?: string
  hideLabel?: boolean
  required?: boolean
}

export function PageFilterField({
  id,
  label,
  children,
  width = 'default',
  className,
  hideLabel = false,
  required = false,
}: PageFilterFieldProps) {
  return (
    <div className={clsx('page-filter-field shrink-0', fieldWidthClasses[width], className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'label-text'}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {children}
    </div>
  )
}

type PageFilterClearButtonProps = {
  onClick: () => void
  label?: string
  className?: string
}

export function PageFilterClearButton({
  onClick,
  label = 'Clear Filters',
  className,
}: PageFilterClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx('btn-secondary text-sm py-2 whitespace-nowrap shrink-0', className)}
    >
      {label}
    </button>
  )
}

type PageFilterActionsProps = {
  children: ReactNode
  className?: string
}

export function PageFilterActions({ children, className }: PageFilterActionsProps) {
  return (
    <div
      className={clsx(
        'page-filter-actions flex items-center gap-2 shrink-0 ml-auto pl-0 lg:pl-2 lg:border-l border-white/10',
        className
      )}
    >
      {children}
    </div>
  )
}

type PageFilterBadgeProps = {
  children: ReactNode
  className?: string
}

/** Read-only filter value (e.g. class teacher scope). Matches control height. */
export function PageFilterBadge({ children, className }: PageFilterBadgeProps) {
  return (
    <span
      className={clsx(
        'page-filter-badge inline-flex w-full items-center px-3 rounded-lg text-sm font-medium text-amber-100 border border-amber-400/30 bg-amber-400/10',
        className
      )}
    >
      {children}
    </span>
  )
}
