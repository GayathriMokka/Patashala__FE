'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Persist a string value in the URL query string so browser refresh keeps the same view.
 * Uses history.replaceState to avoid full navigation.
 */
export function useUrlQueryState(
  paramName: string,
  validValues: readonly string[],
  defaultValue: string
): [string, (value: string) => void] {
  const readFromUrl = useCallback((): string => {
    if (typeof window === 'undefined') return defaultValue
    const value = new URLSearchParams(window.location.search).get(paramName)
    if (value && validValues.includes(value)) return value
    return defaultValue
  }, [paramName, validValues, defaultValue])

  const [value, setValueState] = useState<string>(defaultValue)

  useEffect(() => {
    setValueState(readFromUrl())
  }, [readFromUrl])

  useEffect(() => {
    const onPopState = () => setValueState(readFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [readFromUrl])

  const setValue = useCallback(
    (next: string) => {
      const resolved = validValues.includes(next) ? next : defaultValue
      setValueState(resolved)

      if (typeof window === 'undefined') return

      const url = new URL(window.location.href)
      if (resolved === defaultValue) {
        url.searchParams.delete(paramName)
      } else {
        url.searchParams.set(paramName, resolved)
      }
      window.history.replaceState(window.history.state, '', url.toString())
    },
    [paramName, validValues, defaultValue]
  )

  return [value, setValue]
}

/**
 * Nullable variant — empty/default clears the query param.
 */
export function useUrlQueryStateNullable(
  paramName: string,
  validValues: readonly string[]
): [string | null, (value: string | null) => void] {
  const readFromUrl = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    const value = new URLSearchParams(window.location.search).get(paramName)
    if (value && validValues.includes(value)) return value
    return null
  }, [paramName, validValues])

  const [value, setValueState] = useState<string | null>(null)

  useEffect(() => {
    setValueState(readFromUrl())
  }, [readFromUrl])

  useEffect(() => {
    const onPopState = () => setValueState(readFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [readFromUrl])

  const setValue = useCallback(
    (next: string | null) => {
      const resolved = next && validValues.includes(next) ? next : null
      setValueState(resolved)

      if (typeof window === 'undefined') return

      const url = new URL(window.location.href)
      if (!resolved) {
        url.searchParams.delete(paramName)
      } else {
        url.searchParams.set(paramName, resolved)
      }
      window.history.replaceState(window.history.state, '', url.toString())
    },
    [paramName, validValues]
  )

  return [value, setValue]
}
