import axios, { type AxiosRequestConfig } from 'axios'

let scopeHeaderInterceptorInstalled = false

/**
 * Ensures every API request carries branch-id and academic-year-id from localStorage
 * when callers omit them (prevents cross-branch / cross-year data bleed).
 */
export function installScopeHeaderInterceptor(): void {
  if (scopeHeaderInterceptorInstalled || typeof window === 'undefined') return
  scopeHeaderInterceptorInstalled = true

  axios.interceptors.request.use((config) => {
    const scopeHeaders = buildAuthHeaders()
    config.headers = {
      ...scopeHeaders,
      ...(config.headers as Record<string, string> | undefined),
    }
    return config
  })
}

/**
 * API base URL.
 * Browser: uses NEXT_PUBLIC_API_URL when set (direct to backend, avoids Next proxy drops),
 * otherwise same-origin /api via Next.js rewrites.
 */
export function getApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return configured || '/api'
  }
  return configured || 'http://localhost:5000/api'
}

/** Alias used by attendance and other modules */
export const getApiBaseUrl = getApiUrl

/** Read the latest auth headers from storage (avoids stale React state). */
export function buildAuthHeaders(
  token?: string | null,
  academicYearId?: number | string | null
): Record<string, string> {
  const headers: Record<string, string> = {}

  const resolvedToken =
    token ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
  if (resolvedToken) {
    headers.Authorization = `Bearer ${resolvedToken}`
  }

  let yearId = academicYearId
  if (yearId == null && typeof window !== 'undefined') {
    const stored = localStorage.getItem('academicYear')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { id?: number | string }
        yearId = parsed?.id
      } catch {
        /* ignore */
      }
    }
  }
  if (yearId != null && yearId !== '') {
    headers['academic-year-id'] = String(yearId)
  }

  if (typeof window !== 'undefined') {
    const storedBranch = localStorage.getItem('branchSelection')
    if (storedBranch) {
      try {
        const parsed = JSON.parse(storedBranch) as { mode?: string; id?: number | string }
        if (parsed.mode === 'all') {
          headers['branch-id'] = 'all'
        } else if (parsed.mode === 'single' && parsed.id != null && parsed.id !== '') {
          headers['branch-id'] = String(parsed.id)
        }
      } catch {
        /* ignore */
      }
    }

    const storedSchool = localStorage.getItem('schoolSelection')
    if (storedSchool) {
      try {
        const parsed = JSON.parse(storedSchool) as { id?: number | string }
        if (parsed.id != null && parsed.id !== '') {
          headers['school-id'] = String(parsed.id)
        }
      } catch {
        /* ignore */
      }
    }
  }

  return headers
}

export function withAuthConfig(
  config: AxiosRequestConfig = {},
  token?: string | null,
  academicYearId?: number | string | null
): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...buildAuthHeaders(token, academicYearId),
      ...(config.headers as Record<string, string> | undefined),
    },
  }
}
