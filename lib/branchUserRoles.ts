/** Roles with access across all branches (branch switcher in header). */
export const SCHOOL_WIDE_ROLE_NAMES = new Set(['Super Admin', 'School Admin'])

/** Roles that must be registered to a single branch. */
export const BRANCH_ASSIGNABLE_ROLE_NAMES = new Set([
  'Branch Admin',
  'Branch In Charge',
  'Principal',
  'Teacher',
  'Accountant',
  'Clerk',
  'Receptionist',
  'Peon',
  'Security',
  'Librarian',
  'Lab Assistant',
  'Attendance Master',
  'Attendance Operator',
  'Van Driver',
  'Driver',
])

export function isSchoolWideRole(roleName?: string | null): boolean {
  return SCHOOL_WIDE_ROLE_NAMES.has(String(roleName || '').trim())
}

export function isBranchAssignableRole(roleName?: string | null): boolean {
  return BRANCH_ASSIGNABLE_ROLE_NAMES.has(String(roleName || '').trim())
}

export function requiresBranchAssignment(roleName?: string | null): boolean {
  return isBranchAssignableRole(roleName)
}
