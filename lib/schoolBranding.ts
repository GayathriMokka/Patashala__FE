export interface SchoolBranding {
  school_id: number
  /** School-level name (never replaced by branch selection) */
  name: string
  school_name?: string
  branch_name?: string | null
  branch_code?: string | null
  logo_url: string | null
  code?: string
  /** Millisecond timestamp for cache-busting logo images after updates */
  logo_version?: number | null
}

function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')
}

/**
 * Resolve school logo to a loadable URL.
 * In the browser, uses same-origin /uploads (proxied to API server via next.config rewrites).
 * Pass logo_version to bust browser cache after logo changes.
 */
export function getSchoolLogoUrl(
  logoPath: string | null | undefined,
  version?: number | null
): string | null {
  if (!logoPath || typeof logoPath !== 'string') return null

  const trimmed = logoPath.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (version) {
      const sep = trimmed.includes('?') ? '&' : '?'
      return `${trimmed}${sep}v=${version}`
    }
    return trimmed
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const withVersion =
    version != null
      ? `${path}${path.includes('?') ? '&' : '?'}v=${version}`
      : path

  if (typeof window !== 'undefined') {
    return withVersion
  }

  return `${getApiBase()}${withVersion}`
}

export function isPlatformAdmin(roleName: string | undefined | null): boolean {
  return roleName === 'Super Admin'
}

export function shouldShowSchoolBranding(
  roleName: string | undefined | null,
  schoolId: number | null | undefined
): boolean {
  return !isPlatformAdmin(roleName) && schoolId != null && schoolId > 0
}
