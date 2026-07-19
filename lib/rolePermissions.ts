/** Central role checks — keep in sync with server route guards */

export const FEE_COLLECT_ROLES = ['Super Admin', 'School Admin', 'Accountant'] as const

export const STUDENT_MANAGE_ROLES = ['Super Admin', 'School Admin', 'Principal'] as const

export const STUDENT_DELETE_ROLES = ['Super Admin', 'School Admin'] as const

export const ATTENDANCE_MARK_ROLES = [
  'Super Admin',
  'School Admin',
  'Principal',
  'Teacher',
] as const

function hasRole(roleName: string | null | undefined, allowed: readonly string[]): boolean {
  if (!roleName) return false
  return allowed.includes(roleName)
}

export function canCollectFees(roleName?: string | null): boolean {
  return hasRole(roleName, FEE_COLLECT_ROLES)
}

export function canManageStudents(roleName?: string | null): boolean {
  return hasRole(roleName, STUDENT_MANAGE_ROLES)
}

export function canDeleteStudents(roleName?: string | null): boolean {
  return hasRole(roleName, STUDENT_DELETE_ROLES)
}

export function canMarkAttendance(roleName?: string | null): boolean {
  return hasRole(roleName, ATTENDANCE_MARK_ROLES)
}

/** @deprecated Use getDashboardQuickActions from @/lib/dashboardConfig */
export type DashboardQuickAction = 'add-student' | 'mark-attendance' | 'collect-fee'

/** @deprecated Use getDashboardQuickActions from @/lib/dashboardConfig */
export function getDashboardQuickActionsLegacy(roleName?: string | null): DashboardQuickAction[] {
  const actions: DashboardQuickAction[] = []
  if (canManageStudents(roleName)) actions.push('add-student')
  if (canMarkAttendance(roleName)) actions.push('mark-attendance')
  if (canCollectFees(roleName)) actions.push('collect-fee')
  return actions
}
