'use client'

import { useMemo, useState, type RefObject } from 'react'
import { Check, ChevronRight, Lock, Search } from 'lucide-react'
import { getModuleMeta } from '@/lib/featureModuleMeta'

export type FeatureModule = {
  id: string
  label: string
  features: { key: string; label: string }[]
  isRoleModule?: boolean
}

type Props = {
  modules: FeatureModule[]
  selected: Set<string>
  onChange: (key: string, checked: boolean) => void
  lockedKeys?: Set<string>
  readOnly?: boolean
  showSearch?: boolean
  scrollRootRef?: RefObject<HTMLDivElement | null>
}

function moduleStatusClass(count: number, total: number) {
  if (total === 0) return 'fm-module-pill-neutral'
  if (count === 0) return 'fm-module-pill-none'
  if (count === total) return 'fm-module-pill-full'
  return 'fm-module-pill-partial'
}

function moduleStatusLabel(count: number, total: number) {
  if (total === 0) return '0'
  return `${count}/${total}`
}

export default function FeatureAccordion({
  modules,
  selected,
  onChange,
  lockedKeys = new Set(),
  readOnly = false,
  showSearch = false,
  scrollRootRef,
}: Props) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    modules.slice(0, 2).forEach((m) => {
      initial[m.id] = true
    })
    return initial
  })

  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return modules
    return modules
      .map((mod) => ({
        ...mod,
        features: mod.features.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            mod.label.toLowerCase().includes(q)
        ),
      }))
      .filter((mod) => mod.features.length > 0)
  }, [modules, query])

  const isOpen = (id: string) => !!expanded[id]

  const preserveScroll = () => {
    const root = scrollRootRef?.current
    if (!root) return
    const scrollTop = root.scrollTop
    requestAnimationFrame(() => {
      root.scrollTop = scrollTop
      requestAnimationFrame(() => {
        root.scrollTop = scrollTop
      })
    })
  }

  const toggle = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
    preserveScroll()
  }

  const countIn = (mod: FeatureModule) =>
    mod.features.filter((f) => selected.has(f.key) && !lockedKeys.has(f.key)).length

  const toggleAll = (mod: FeatureModule, on: boolean, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    mod.features.forEach((f) => {
      if (!lockedKeys.has(f.key) && !readOnly) onChange(f.key, on)
    })
    preserveScroll()
  }

  if (filteredModules.length === 0) {
    return (
      <p className="text-sm text-slate-600 text-center py-10">No permissions match your search.</p>
    )
  }

  return (
    <div className="fm-accordion">
      {showSearch && (
        <div className="fm-accordion-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter permissions by module or action…"
            className="fm-search-input"
            aria-label="Filter permissions"
          />
        </div>
      )}

      <div className="fm-accordion-list space-y-2">
        {filteredModules.map((mod) => {
          const meta = getModuleMeta(mod.id)
          const Icon = meta.icon
          const open = isOpen(mod.id)
          const count = countIn(mod)
          const total = mod.features.filter((f) => !lockedKeys.has(f.key)).length
          const allOn = total > 0 && count === total

          return (
            <div key={mod.id} className={`fm-module ${open ? 'fm-module-open' : ''}`}>
              <div className="fm-module-head">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => toggle(mod.id, e)}
                  className="fm-module-head-btn"
                  aria-expanded={open}
                >
                  <ChevronRight
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                  <span className={`fm-module-icon ${meta.bg}`}>
                    <Icon className={`w-4 h-4 ${meta.accent}`} aria-hidden />
                  </span>
                  <span className="fm-module-title">{mod.label}</span>
                  <span
                    className={`fm-module-pill ${moduleStatusClass(count, total)}`}
                    title={`${count} of ${total} permissions enabled`}
                  >
                    {moduleStatusLabel(count, total)}
                  </span>
                </button>
                {!readOnly && total > 0 && (
                  <button
                    type="button"
                    onClick={(e) => toggleAll(mod, !allOn, e)}
                    className={`fm-module-action ${allOn ? 'fm-module-action-clear' : 'fm-module-action-enable'}`}
                    title={allOn ? 'Turn off all permissions in this module' : 'Turn on all permissions in this module'}
                  >
                    {allOn ? 'Clear all' : 'Enable all'}
                  </button>
                )}
              </div>

              {open && (
                <div className="fm-module-items">
                  {mod.features.map((feature) => {
                    const locked = lockedKeys.has(feature.key)
                    const checked = selected.has(feature.key)
                    const disabled = readOnly || locked

                    return (
                      <label
                        key={feature.key}
                        className={`fm-check ${checked ? 'fm-check-on' : ''} ${locked ? 'fm-check-locked' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) => {
                            onChange(feature.key, e.target.checked)
                            preserveScroll()
                          }}
                        />
                        <span className="fm-check-box" aria-hidden>
                          {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                          {locked && !checked && <Lock className="w-2.5 h-2.5 text-slate-400" />}
                        </span>
                        <span className="fm-check-label">{feature.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
