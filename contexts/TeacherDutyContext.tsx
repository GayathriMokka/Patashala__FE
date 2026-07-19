'use client'

import React, { createContext, useContext } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { BASE_TEACHER_PATHS } from '@/lib/teacherRoleFeatures'
import {
  deriveClassTeacherScopes,
  type ClassTeacherScope,
  type ClassTeacherAssignment,
} from '@/lib/classTeacherScope'
import { getApiUrl } from '@/lib/api'

const EMPTY_TEACHER_DUTY = {
  teacher_id: null,
  assignments: [] as TeacherDutyAssignment[],
  role_types: [] as string[],
  features: ['dashboard'],
  menu_paths: ['/dashboard'],
  class_teacher_scopes: [] as ClassTeacherScope[],
  is_class_teacher: false,
}

export type TeacherDutyAssignment = ClassTeacherAssignment & {
  id: number
  subject_name?: string | null
  remarks?: string | null
}

export type { ClassTeacherScope }

type TeacherDutyContextValue = {
  teacherId: number | null
  assignments: TeacherDutyAssignment[]
  roleTypes: string[]
  features: string[]
  menuPaths: string[]
  classTeacherScopes: ClassTeacherScope[]
  isClassTeacher: boolean
  isLoading: boolean
  canAccessPath: (path: string) => boolean
  refetch: () => void
}

const TeacherDutyContext = createContext<TeacherDutyContextValue | undefined>(undefined)

export function TeacherDutyProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth()
  const { academicYear, isLoading: yearLoading } = useAcademicYear()

  const enabled =
    !authLoading &&
    !yearLoading &&
    !!user &&
    !!token &&
    user.role_name === 'Teacher' &&
    !!user.school_id &&
    !!academicYear?.id

  const { data, isLoading, isFetching, refetch } = useQuery(
    ['teacher-duty-context', user?.id, user?.school_id, academicYear?.id, token],
    async () => {
      const authToken =
        token ||
        (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
      if (!authToken || !user?.school_id || !academicYear?.id) {
        return EMPTY_TEACHER_DUTY
      }

      try {
        const response = await axios.get(`${getApiUrl()}/teacher-roles/my-context`, {
          params: {
            school_id: user.school_id,
            academic_year_id: academicYear.id,
          },
          headers: {
            Authorization: `Bearer ${authToken}`,
            'academic-year-id': String(academicYear.id),
          },
        })
        return response.data.data
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401) {
          return EMPTY_TEACHER_DUTY
        }
        throw error
      }
    },
    {
      enabled,
      retry: false,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      keepPreviousData: true,
    }
  )

  const menuPaths =
    user?.role_name === 'Teacher' && data?.menu_paths?.length ? data.menu_paths : []

  const assignments: TeacherDutyAssignment[] = data?.assignments || []
  const classTeacherScopes = deriveClassTeacherScopes(
    assignments,
    data?.class_teacher_scopes || []
  )
  const isClassTeacher = classTeacherScopes.length > 0

  const value: TeacherDutyContextValue = {
    teacherId: data?.teacher_id ?? null,
    assignments,
    roleTypes: data?.role_types || [],
    features: data?.features || [],
    menuPaths,
    classTeacherScopes,
    isClassTeacher,
    isLoading: enabled && (isLoading || (isFetching && !data)),
    canAccessPath: (path: string) => {
      if (!user || user.role_name !== 'Teacher') return true
      if (enabled && (isLoading || (isFetching && !data))) return true
      const allowed = menuPaths.length ? menuPaths : BASE_TEACHER_PATHS
      return allowed.some((p) => path === p || path.startsWith(`${p}/`))
    },
    refetch,
  }

  return <TeacherDutyContext.Provider value={value}>{children}</TeacherDutyContext.Provider>
}

export function useTeacherDuty() {
  const ctx = useContext(TeacherDutyContext)
  if (!ctx) {
    return {
      teacherId: null,
      assignments: [],
      roleTypes: [],
      features: [],
      menuPaths: [],
      classTeacherScopes: [],
      isClassTeacher: false,
      isLoading: false,
      canAccessPath: () => true,
      refetch: () => {},
    }
  }
  return ctx
}
