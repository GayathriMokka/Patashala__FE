'use client'

import { useEffect } from 'react'

const MAX_VISIBLE_OPTIONS = 8

function isSingleSelect(el: EventTarget | null): el is HTMLSelectElement {
  return (
    el instanceof HTMLSelectElement &&
    !el.multiple &&
    !el.disabled &&
    !el.hasAttribute('data-native-select')
  )
}

function expand(select: HTMLSelectElement) {
  const count = select.options.length
  if (count <= MAX_VISIBLE_OPTIONS) return
  select.size = MAX_VISIBLE_OPTIONS
  select.classList.add('select-expanded')

  let longest = 0
  for (const option of select.options) {
    longest = Math.max(longest, option.text.length)
  }
  const estimatedWidth = Math.min(Math.max(select.offsetWidth, longest * 8 + 48), 420)
  select.style.minWidth = `${estimatedWidth}px`
}

function collapse(select: HTMLSelectElement) {
  select.size = 1
  select.classList.remove('select-expanded')
  select.style.minWidth = ''
}

export default function ScrollableNativeSelectEnhancer() {
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!isSingleSelect(e.target)) return
      expand(e.target)
    }

    const onFocusOut = (e: FocusEvent) => {
      if (!isSingleSelect(e.target)) return
      collapse(e.target)
    }

    const onChange = (e: Event) => {
      if (!isSingleSelect(e.target)) return
      collapse(e.target)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSingleSelect(e.target)) return
      if (e.key === 'Escape') collapse(e.target)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('change', onChange)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('change', onChange)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return null
}
