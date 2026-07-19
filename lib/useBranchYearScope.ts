'use client'

import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAcademicYear } from '@/contexts/AcademicYearContext'
import { useBranch } from '@/contexts/BranchContext'
import { buildBranchScopedHeaders, getBranchScopeKey } from '@/lib/branchAccess'

/**
 * Standard branch + academic year scope for API calls and react-query keys.
 * Use on every page that loads or mutates school data.
 */
export function useBranchYearScope() {
  const { token } = useAuth()
  const { academicYear } = useAcademicYear()
  const { branch, isAllBranches } = useBranch()

  const branchScopeKey = useMemo(
    () => getBranchScopeKey(branch?.id, isAllBranches),
    [branch?.id, isAllBranches]
  )

  const scopedHeaders = useMemo(
    () =>
      buildBranchScopedHeaders(token || '', {
        academicYearId: academicYear?.id,
        branchId: branch?.id,
        isAllBranches,
      }),
    [token, academicYear?.id, branch?.id, isAllBranches]
  )

  const canWriteBranchScoped = !isAllBranches && !!branch?.id

  const branchLabel = isAllBranches ? 'All branches' : branch?.name || 'Selected branch'

  const requireAcademicYearSelected = (): string | null => {
    if (!academicYear?.id) {
      return 'Select an academic year from the top bar.'
    }
    return null
  }

  const requireBranchForWrite = (): string | null => {
    if (isAllBranches) {
      return 'Select a specific branch from the top bar before continuing.'
    }
    if (!branch?.id) {
      return 'A branch must be selected.'
    }
    return null
  }

  return {
    token,
    academicYear,
    branch,
    isAllBranches,
    branchScopeKey,
    scopedHeaders,
    canWriteBranchScoped,
    branchLabel,
    requireAcademicYearSelected,
    requireBranchForWrite,
  }
}
