/**
 * Branch visibility and access rules.
 * Only School Admin may switch branches via the header dropdown.
 */

import { isBranchAssignableRole, isSchoolWideRole } from '@/lib/branchUserRoles'

export function canSwitchBranches(roleName: string | undefined | null): boolean {
  return roleName === 'School Admin'
}

export function shouldShowBranchSelector(roleName: string | undefined | null): boolean {
  return canSwitchBranches(roleName)
}

export function isBranchLockedUser(roleName: string | undefined | null, branchId?: number | null): boolean {
  if (canSwitchBranches(roleName) || isSchoolWideRole(roleName)) return false
  if (branchId != null && branchId > 0) return true
  return isBranchAssignableRole(roleName)
}

/** React-query cache key segment for branch-scoped data. */
export function getBranchScopeKey(
  branchId: number | null | undefined,
  isAllBranches: boolean
): string {
  if (isAllBranches) return 'all'
  if (branchId != null && branchId > 0) return String(branchId)
  return 'none'
}

/** Request headers for branch-scoped API calls (do not rely on axios defaults alone). */
export function buildBranchScopedHeaders(
  token: string,
  options?: {
    academicYearId?: string | number | null
    branchId?: number | null
    isAllBranches?: boolean
    schoolId?: number | null
  }
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  }

  if (options?.academicYearId != null && options.academicYearId !== '') {
    headers['academic-year-id'] = String(options.academicYearId)
  }

  if (options?.isAllBranches) {
    headers['branch-id'] = 'all'
  } else if (options?.branchId != null && options.branchId > 0) {
    headers['branch-id'] = String(options.branchId)
  }

  if (options?.schoolId != null && options.schoolId > 0) {
    headers['school-id'] = String(options.schoolId)
  }

  return headers
}
