'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import { useQueryClient } from 'react-query'
import { useAuth } from './AuthContext'
import { useSchool } from './SchoolContext'
import { buildAuthHeaders, getApiUrl } from '@/lib/api'

interface AcademicYear {
  id: number | string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  is_locked: boolean
  is_archived: boolean
}

interface AcademicYearContextType {
  academicYear: AcademicYear | null
  academicYears: AcademicYear[]
  setAcademicYear: (year: AcademicYear | null) => void
  loadAcademicYears: () => Promise<void>
  isLoading: boolean
}

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined)

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth()
  const { selectedSchool } = useSchool()
  const queryClient = useQueryClient()
  const [academicYear, setAcademicYearState] = useState<AcademicYear | null>(null)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (isAuthenticated && user && token) {
      loadAcademicYears()
      return
    }

    setAcademicYears([])
    setAcademicYearState(null)
    setIsLoading(false)
    localStorage.removeItem('academicYear')
    delete axios.defaults.headers.common['academic-year-id']
  }, [user?.id, user?.school_id, selectedSchool?.id, token, isAuthenticated, authLoading])

  const loadAcademicYears = async () => {
    try {
      const effectiveSchoolId =
        user?.role_name === 'Super Admin' ? selectedSchool?.id ?? null : user?.school_id ?? null

      if (!effectiveSchoolId) {
        setAcademicYears([])
        setIsLoading(false)
        return
      }

      const response = await axios.get(`${getApiUrl()}/academic-years`, {
        params: { school_id: effectiveSchoolId },
        headers: buildAuthHeaders(token),
      })

      const years = response.data.data || []
      setAcademicYears(years)

      // Validate stored academic year against loaded years
      const stored = localStorage.getItem('academicYear')
      let yearSet = false
      
      if (stored) {
        try {
          const storedYear = JSON.parse(stored)
          // Check if stored year exists in the loaded years for this school
          // Note: school_id might not be in the interface, so we'll just check by ID
          const storedYearId = Number(storedYear.id)
          const isValidStoredYear = years.some((y: AcademicYear) => Number(y.id) === storedYearId)
          if (isValidStoredYear) {
            // Use the server-fresh matching object to avoid stale/mismatched types
            const matchedYear = years.find((y: AcademicYear) => Number(y.id) === storedYearId) || storedYear
            setAcademicYearState(matchedYear)
            axios.defaults.headers.common['academic-year-id'] = matchedYear.id.toString()
            yearSet = true
          } else {
            // Stored year doesn't exist in loaded years, clear it
            localStorage.removeItem('academicYear')
            setAcademicYearState(null)
            delete axios.defaults.headers.common['academic-year-id']
          }
        } catch (error) {
          console.error('Failed to parse stored academic year:', error)
          localStorage.removeItem('academicYear')
        }
      }

      // Set active year if not already set
      if (!yearSet && years.length > 0) {
        const activeYear = years.find((y: AcademicYear) => y.is_active) || years[0]
        if (activeYear) {
          setAcademicYearState(activeYear)
          localStorage.setItem('academicYear', JSON.stringify(activeYear))
          axios.defaults.headers.common['academic-year-id'] = activeYear.id.toString()
        }
      }
    } catch (error) {
      console.error('Failed to load academic years:', error)
      setAcademicYears([])
    } finally {
      setIsLoading(false)
    }
  }

  const setAcademicYear = (year: AcademicYear | null) => {
    setAcademicYearState(year)
    if (year) {
      localStorage.setItem('academicYear', JSON.stringify(year))
      axios.defaults.headers.common['academic-year-id'] = year.id.toString()
    } else {
      localStorage.removeItem('academicYear')
      delete axios.defaults.headers.common['academic-year-id']
    }
    queryClient.invalidateQueries()
  }

  useEffect(() => {
    // Restore selection for UI only — axios header is set after server validation in loadAcademicYears
    const stored = localStorage.getItem('academicYear')
    if (stored) {
      try {
        const year = JSON.parse(stored)
        setAcademicYearState(year)
      } catch (error) {
        console.error('Failed to parse stored academic year:', error)
      }
    }
  }, [])

  return (
    <AcademicYearContext.Provider
      value={{
        academicYear,
        academicYears,
        setAcademicYear,
        loadAcademicYears,
        isLoading,
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  )
}

export function useAcademicYear() {
  const context = useContext(AcademicYearContext)
  if (context === undefined) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider')
  }
  return context
}
