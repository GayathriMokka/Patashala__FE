'use client'

import React, { createContext, useCallback, useContext, useMemo } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { getApiUrl, buildAuthHeaders } from '@/lib/api'

type TeacherDutyMeta = {
  role_types: string[]
  is_class_teacher: boolean
  allowed_modules: string[]
}

type SchoolFeaturesContextValue = {
  features: string[]
  menuPaths: string[]
  isLoading: boolean
  permissionsReady: boolean
  isSuperAdmin: boolean
  teacherDuty: TeacherDutyMeta | null
  canAccessPath: (path: string) => boolean
  hasFeature: (key: string) => boolean
  refetch: () => void
}

const SchoolFeaturesContext = createContext<SchoolFeaturesContextValue | undefined>(undefined)

export function SchoolFeaturesProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth()
  const { academicYear, isLoading: yearLoading } = useAcademicYear()

  const needsYear = user?.role_name === 'Teacher'
  const queryEnabled =
    !authLoading &&
    !yearLoading &&
    !!user &&
    !!token &&
    (!needsYear || !!academicYear?.id)

  const contextQueryKey = needsYear
    ? ['school-features-context', user?.id, user?.school_id, user?.role_id, academicYear?.id]
    : ['school-features-context', user?.id, user?.school_id, user?.role_id]

  const { data, isLoading, isFetching, refetch } = useQuery(
    contextQueryKey,
    async () => {
      const authToken =
        token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
      if (!authToken || !user) {
        return { features: [], menu_paths: [], is_super_admin: false, teacher_duty: null }
      }

      const response = await axios.get(`${getApiUrl()}/school-features/my-context`, {
        headers: buildAuthHeaders(authToken, needsYear ? academicYear?.id : undefined),
      })
      return response.data.data as {
        features: string[]
        menu_paths: string[]
        is_super_admin?: boolean
        teacher_duty?: TeacherDutyMeta | null
      }
    },
    {
      enabled: queryEnabled,
      staleTime: 30_000,
      keepPreviousData: needsYear,
    }
  )

  const features = data?.features ?? []
  const menuPaths = data?.menu_paths ?? []
  const isSuperAdmin = data?.is_super_admin || user?.role_name === 'Super Admin'
  const teacherDuty = data?.teacher_duty ?? null
  const permissionsReady = !queryEnabled || (!isLoading && !isFetching && !!data)

  const featureSet = useMemo(() => new Set(features), [features])

  const canAccessPath = useCallback(
    (path: string) => {
      if (isSuperAdmin) return true
      if (!permissionsReady) return false
      const normalized = path.split('?')[0].replace(/\/$/, '') || '/'
      return menuPaths.some(
        (p) => normalized === p || normalized.startsWith(`${p}/`)
      )
    },
    [isSuperAdmin, permissionsReady, menuPaths]
  )

  const hasFeature = useCallback(
    (key: string) => {
      if (isSuperAdmin) return true
      if (!permissionsReady) return false
      return featureSet.has(key)
    },
    [isSuperAdmin, permissionsReady, featureSet]
  )

  return (
    <SchoolFeaturesContext.Provider
      value={{
        features,
        menuPaths,
        isLoading: authLoading || yearLoading || isLoading || (queryEnabled && isFetching && !data),
        permissionsReady,
        isSuperAdmin,
        teacherDuty,
        canAccessPath,
        hasFeature,
        refetch,
      }}
    >
      {children}
    </SchoolFeaturesContext.Provider>
  )
}

export function useSchoolFeatures() {
  const ctx = useContext(SchoolFeaturesContext)
  if (!ctx) {
    throw new Error('useSchoolFeatures must be used within SchoolFeaturesProvider')
  }
  return ctx
}
