'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import axios from 'axios'
import { useAuth } from '@/contexts/AuthContext'
import { useBranch } from '@/contexts/BranchContext'
import {
  SchoolBranding,
  getSchoolLogoUrl,
  isPlatformAdmin,
  shouldShowSchoolBranding,
} from '@/lib/schoolBranding'

interface SchoolBrandingContextType {
  branding: SchoolBranding | null
  isLoading: boolean
  isPlatformAdmin: boolean
  refreshBranding: () => Promise<void>
}

const SchoolBrandingContext = createContext<SchoolBrandingContextType | undefined>(
  undefined
)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
const BRANDING_CACHE_KEY = 'patashala_school_branding'

function readCachedBranding(schoolId: number): SchoolBranding | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(BRANDING_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SchoolBranding
    return parsed?.school_id === schoolId ? parsed : null
  } catch {
    return null
  }
}

function writeCachedBranding(data: SchoolBranding | null) {
  if (typeof window === 'undefined') return
  try {
    if (data) {
      sessionStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(data))
    } else {
      sessionStorage.removeItem(BRANDING_CACHE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

function normalizeBranding(data: SchoolBranding): SchoolBranding {
  return {
    ...data,
    school_id: Number(data.school_id),
    logo_url: data.logo_url ? getSchoolLogoUrl(data.logo_url) : null,
    logo_version: data.logo_version ?? null,
  }
}

function brandingFromUser(user: {
  school_id: number | null
  school_name?: string | null
  school_logo_url?: string | null
}): SchoolBranding | null {
  if (!user.school_id || !user.school_name) return null
  return {
    school_id: Number(user.school_id),
    name: user.school_name,
    logo_url: user.school_logo_url ?? null,
    logo_version: null,
  }
}

export function SchoolBrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading: authLoading } = useAuth()
  const { branch, isAllBranches } = useBranch()
  const [schoolBranding, setSchoolBranding] = useState<SchoolBranding | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fetchedForSchoolRef = useRef<number | null>(null)

  const platformAdmin = useMemo(
    () => isPlatformAdmin(user?.role_name),
    [user?.role_name]
  )

  const schoolId = user?.school_id != null ? Number(user.school_id) : null

  const fetchBranding = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token || !user || platformAdmin || !schoolId) {
        setSchoolBranding(null)
        writeCachedBranding(null)
        return
      }

      if (!shouldShowSchoolBranding(user.role_name, schoolId)) {
        setSchoolBranding(null)
        writeCachedBranding(null)
        return
      }

      if (!options?.silent) {
        setIsLoading(true)
      }

      try {
        const response = await axios.get(`${API_URL}/auth/school-branding`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = response.data?.data as SchoolBranding | null
        if (data) {
          const normalized = normalizeBranding(data)
          setSchoolBranding(normalized)
          writeCachedBranding(normalized)
          fetchedForSchoolRef.current = schoolId
        }
      } catch {
        const fallback = brandingFromUser(user) || readCachedBranding(schoolId)
        if (fallback) {
          const normalized = normalizeBranding(fallback)
          setSchoolBranding(normalized)
          writeCachedBranding(normalized)
        }
      } finally {
        setIsLoading(false)
      }
    },
    [token, user, platformAdmin, schoolId]
  )

  useEffect(() => {
    if (authLoading) return

    if (!user || platformAdmin || !schoolId) {
      setSchoolBranding(null)
      fetchedForSchoolRef.current = null
      return
    }

    const fromUser = brandingFromUser(user)
    const fromCache = readCachedBranding(schoolId)
    const seed = fromUser || fromCache

    if (seed) {
      setSchoolBranding(normalizeBranding(seed))
    }

    fetchBranding({ silent: !!seed })
  }, [authLoading, user?.id, schoolId, user?.school_name, user?.school_logo_url, platformAdmin, fetchBranding])

  const branding = useMemo((): SchoolBranding | null => {
    if (!schoolBranding) return null
    if (isAllBranches || !branch) {
      return {
        ...schoolBranding,
        school_name: schoolBranding.name,
        branch_name: null,
        branch_code: null,
      }
    }

    const branchLogoVersion = branch.updated_at
      ? new Date(branch.updated_at).getTime()
      : branch.id

    const branchLogo = branch.logo_url
      ? getSchoolLogoUrl(branch.logo_url, branchLogoVersion)
      : schoolBranding.logo_url

    return {
      ...schoolBranding,
      school_name: schoolBranding.name,
      name: schoolBranding.name,
      branch_name: branch.name || null,
      branch_code: branch.code || null,
      logo_url: branchLogo,
      logo_version: branchLogoVersion,
    }
  }, [schoolBranding, branch, isAllBranches])

  useEffect(() => {
    if (!user || platformAdmin) return
    const onFocus = () => fetchBranding({ silent: true })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user, platformAdmin, fetchBranding])

  return (
    <SchoolBrandingContext.Provider
      value={{
        branding,
        isLoading,
        isPlatformAdmin: platformAdmin,
        refreshBranding: async () => {
          writeCachedBranding(null)
          fetchedForSchoolRef.current = null
          await fetchBranding({ silent: false })
        },
      }}
    >
      {children}
    </SchoolBrandingContext.Provider>
  )
}

export function useSchoolBranding() {
  const context = useContext(SchoolBrandingContext)
  if (context === undefined) {
    throw new Error('useSchoolBranding must be used within a SchoolBrandingProvider')
  }
  return context
}
