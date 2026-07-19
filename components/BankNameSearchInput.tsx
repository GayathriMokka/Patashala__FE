'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

interface BankNameSearchInputProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function BankNameSearchInput({
  id = 'bank_name',
  name = 'bank_name',
  value,
  onChange,
  placeholder = 'Search bank name...',
  className = 'input-field',
}: BankNameSearchInputProps) {
  const { token } = useAuth()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchBanks = useCallback(
    async (query: string) => {
      if (!query.trim() || query.trim().length < 1) {
        setSuggestions([])
        return
      }
      setLoading(true)
      try {
        const res = await axios.get(`${API_URL}/banks/search`, {
          params: { q: query.trim(), limit: 15 },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        setSuggestions(res.data.data || [])
        setShowDropdown(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchBanks(value)
    }, 280)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, fetchBanks])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectBank = (bank: string) => {
    onChange(bank)
    setShowDropdown(false)
    setSuggestions([])
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowDropdown(true)
        }}
        onFocus={() => {
          if (value.trim()) fetchBanks(value)
          else setShowDropdown(true)
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown && suggestions.length > 0}
        aria-autocomplete="list"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          Searching...
        </span>
      )}
      {showDropdown && (suggestions.length > 0 || (value.trim() && !loading)) && (
        <ul
          className="absolute z-20 w-full mt-1 dropdown-options-scroll dropdown-options-scroll-light bg-white border border-slate-200 rounded-lg shadow-lg"
          role="listbox"
        >
          {suggestions.map((bank) => (
            <li key={bank} role="option">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectBank(bank)}
                className="w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-primary-50 hover:text-primary-900"
              >
                {bank}
              </button>
            </li>
          ))}
          {suggestions.length === 0 && value.trim() && !loading && (
            <li className="px-3 py-2 text-sm text-slate-500">
              No matches — you can keep &quot;{value}&quot; as custom bank name
            </li>
          )}
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">Type to search Indian banks; select from list or enter custom name</p>
    </div>
  )
}
