'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSchoolFeatures } from '@/contexts/SchoolFeaturesContext'
import { APP_MENU_ITEMS, usesFeaturePermissions } from '@/lib/menuConfig'

function normalizePath(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/'
}

/**
 * Resolves whether the current user may open a page path.
 * Feature-managed roles (School Admin, Principal, Branch In Charge, Teacher, etc.)
 * use admin-granted permissions from SchoolFeaturesContext.
 */
export function usePageAccess(path: string) {
  const { user, isLoading: authLoading } = useAuth()
  const {
    canAccessPath,
    hasFeature,
    permissionsReady,
    isSuperAdmin,
    isLoading: featuresLoading,
  } = useSchoolFeatures()

  const normalizedPath = normalizePath(path)

  const canAccess = useMemo(() => {
    if (!user) return false
    if (isSuperAdmin) return true

    if (normalizedPath === '/schools') return false

    if (normalizedPath === '/features') {
      return user.role_name === 'School Admin' && hasFeature('feature_management.access')
    }

    if (usesFeaturePermissions(user.role_name)) {
      if (!permissionsReady) return false
      return canAccessPath(normalizedPath)
    }

    const menuItem = APP_MENU_ITEMS.find(
      (item) =>
        normalizedPath === item.path || normalizedPath.startsWith(`${item.path}/`)
    )
    if (!menuItem) return true
    return menuItem.legacyRoles.includes(user.role_name)
  }, [user, isSuperAdmin, permissionsReady, canAccessPath, hasFeature, normalizedPath])

  const accessLoading =
    authLoading ||
    featuresLoading ||
    (user != null && usesFeaturePermissions(user.role_name) && !permissionsReady)

  return { canAccess, accessLoading, permissionsReady }
}

/** Redirect to dashboard when the user lacks permission for this page. */
export function useRequirePageAccess(path: string) {
  const router = useRouter()
  const { user } = useAuth()
  const { canAccess, accessLoading } = usePageAccess(path)

  useEffect(() => {
    if (accessLoading) return
    if (user && !canAccess) {
      router.replace('/dashboard')
    }
  }, [accessLoading, user, canAccess, router])

  return { canAccess, accessLoading }
}
