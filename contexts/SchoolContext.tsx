'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { useQueryClient } from 'react-query'
import { useAuth } from './AuthContext'
import { buildAuthHeaders, getApiUrl } from '@/lib/api'

export interface SchoolOption {
  id: number
  name: string
  code: string
  db_name?: string | null
}

interface SchoolContextType {
  selectedSchool: SchoolOption | null
  schools: SchoolOption[]
  setSelectedSchool: (school: SchoolOption | null) => void
  loadSchools: () => Promise<void>
  isLoading: boolean
  showSchoolSelector: boolean
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

const STORAGE_KEY = 'schoolSelection'

export function SchoolProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [selectedSchool, setSelectedSchoolState] = useState<SchoolOption | null>(null)
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const showSchoolSelector = user?.role_name === 'Super Admin'

  const applySchoolHeader = useCallback((school: SchoolOption | null) => {
    if (school?.id) {
      axios.defaults.headers.common['school-id'] = String(school.id)
    } else {
      delete axios.defaults.headers.common['school-id']
    }
  }, [])

  const setSelectedSchool = useCallback(
    (school: SchoolOption | null) => {
      setSelectedSchoolState(school)
      if (school?.id) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: school.id, name: school.name }))
        applySchoolHeader(school)
      } else {
        localStorage.removeItem(STORAGE_KEY)
        applySchoolHeader(null)
      }
      queryClient.invalidateQueries()
    },
    [applySchoolHeader, queryClient]
  )

  const loadSchools = useCallback(async () => {
    if (!token || !showSchoolSelector) {
      setSchools([])
      return
    }
    setIsLoading(true)
    try {
      const response = await axios.get(`${getApiUrl()}/schools`, {
        headers: buildAuthHeaders(token),
      })
      const list: SchoolOption[] = (response.data?.data || []).map((s: SchoolOption) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        db_name: s.db_name,
      }))
      setSchools(list)

      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { id?: number }
          const match = list.find((s) => s.id === parsed.id)
          if (match) {
            setSelectedSchoolState(match)
            applySchoolHeader(match)
            return
          }
        } catch {
          /* ignore */
        }
      }

      if (list.length === 1) {
        setSelectedSchool(list[0])
      }
    } catch (error) {
      console.error('Failed to load schools:', error)
    } finally {
      setIsLoading(false)
    }
  }, [token, showSchoolSelector, applySchoolHeader, setSelectedSchool])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated || !showSchoolSelector) {
      setSelectedSchoolState(null)
      setSchools([])
      applySchoolHeader(null)
      return
    }
    loadSchools()
  }, [authLoading, isAuthenticated, showSchoolSelector, loadSchools, applySchoolHeader])

  return (
    <SchoolContext.Provider
      value={{
        selectedSchool,
        schools,
        setSelectedSchool,
        loadSchools,
        isLoading,
        showSchoolSelector,
      }}
    >
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool() {
  const context = useContext(SchoolContext)
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider')
  }
  return context
}
