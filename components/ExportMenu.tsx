'use client'

import { useRef, useState } from 'react'
import { MoreVertical, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import type { ExportFormat } from '@/lib/downloadExport'
import DropdownPanelPortal from './DropdownPanelPortal'
import { useClickOutside } from '@/lib/useFloatingPanel'

type ExportMenuProps = {
  onExport: (format: ExportFormat) => void | Promise<void>
  isExporting?: ExportFormat | null
  disabled?: boolean
  recordCount?: number
  size?: 'sm' | 'md'
  className?: string
  label?: string
}

export default function ExportMenu({
  onExport,
  isExporting = null,
  disabled = false,
  recordCount,
  size = 'md',
  className = '',
  label = 'Download',
}: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useClickOutside([anchorRef, panelRef], () => setOpen(false), open)

  const isBusy = !!isExporting
  const isDisabled = disabled || isBusy || recordCount === 0
  const sizeClasses = size === 'sm' ? 'p-1.5' : 'p-2'
  const iconSize = size === 'sm' ? 14 : 16

  const handleSelect = async (format: ExportFormat) => {
    setOpen(false)
    await onExport(format)
  }

  const title =
    recordCount === 0
      ? 'No data to export'
      : recordCount != null
        ? `Download ${recordCount} record${recordCount === 1 ? '' : 's'}`
        : 'Download'

  return (
    <div className={`relative ${className}`} ref={anchorRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={isDisabled}
        title={title}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`btn-secondary inline-flex items-center justify-center ${sizeClasses} disabled:opacity-40`}
      >
        {isBusy ? (
          <Loader2 className="animate-spin" size={iconSize} aria-hidden />
        ) : (
          <MoreVertical size={iconSize} aria-hidden />
        )}
      </button>

      <DropdownPanelPortal
        open={open}
        anchorRef={anchorRef}
        panelRef={panelRef}
        align="end"
        role="menu"
        className="w-44 py-1"
        style={{ minWidth: '11rem' }}
      >
        <div className="px-3 py-2 border-b border-white/10">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
            Export
          </p>
          {recordCount != null && (
            <p className="text-xs text-white/80 mt-0.5">
              {recordCount} record{recordCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleSelect('excel')}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors"
        >
          <FileSpreadsheet size={16} className="text-emerald-400 shrink-0" aria-hidden />
          <span>
            <span className="block font-medium">Excel</span>
            <span className="block text-[10px] text-white/50">.xlsx spreadsheet</span>
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleSelect('pdf')}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/90 hover:bg-white/10 transition-colors"
        >
          <FileText size={16} className="text-rose-400 shrink-0" aria-hidden />
          <span>
            <span className="block font-medium">PDF</span>
            <span className="block text-[10px] text-white/50">Print-ready document</span>
          </span>
        </button>
      </DropdownPanelPortal>
    </div>
  )
}
