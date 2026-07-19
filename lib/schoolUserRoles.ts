/** Roles excluded from school User Management (create, list tabs, filters). */
/** Student portal removed — families use a single Parent login (set on student admission). */
export const EXCLUDED_SCHOOL_USER_ROLES = ['Super Admin', 'CFO', 'Student'] as const

/** Expert architecture role order for User Management tabs and dropdowns. */
export const SCHOOL_USER_ROLE_ORDER = [
  'School Admin',
  'Branch In Charge',
  'Branch Admin',
  'Principal',
  'Teacher',
  'Accountant',
  'Attendance Master',
  'Attendance Operator',
  'Van Driver',
  'Driver',
  'Parent',
  'Receptionist',
  'Clerk',
  'Peon',
  'Security',
  'Librarian',
  'Lab Assistant',
] as const

export function toRoleTabId(roleName: string): string {
  return roleName.toLowerCase().replace(/\s+/g, '-')
}

export function sortSchoolUserRoles<T extends { name: string }>(roles: T[]): T[] {
  const orderIndex = new Map(SCHOOL_USER_ROLE_ORDER.map((name, index) => [name, index]))
  return [...roles].sort((a, b) => {
    const aIndex = orderIndex.has(a.name) ? orderIndex.get(a.name)! : 999
    const bIndex = orderIndex.has(b.name) ? orderIndex.get(b.name)! : 999
    if (aIndex !== bIndex) return aIndex - bIndex
    return a.name.localeCompare(b.name)
  })
}

export function filterSchoolUserRoles<T extends { name: string }>(roles: T[]): T[] {
  const excluded = new Set<string>(EXCLUDED_SCHOOL_USER_ROLES)
  return sortSchoolUserRoles(roles.filter((role) => !excluded.has(role.name)))
}

const ROLE_TAB_ICONS: Record<string, string> = {
  'School Admin': '🏫',
  'Branch Admin': '🏢',
  'Branch In Charge': '🏛️',
  Principal: '🎓',
  Teacher: '👨‍🏫',
  Parent: '👨‍👩‍👧',
  Accountant: '💰',
  'Attendance Master': '📷',
  'Attendance Operator': '📷',
  'Van Driver': '🚐',
  Driver: '🚐',
  Receptionist: '🛎️',
  Clerk: '📋',
  Peon: '🧹',
  Security: '🛡️',
  Librarian: '📚',
  'Lab Assistant': '🔬',
}

export function getRoleTabIcon(roleName: string): string {
  return ROLE_TAB_ICONS[roleName] || '👤'
}

const DRIVER_ROLE_NAMES = new Set(['Van Driver', 'Driver'])

export function isDriverRole(roleName?: string | null): boolean {
  if (!roleName) return false
  return DRIVER_ROLE_NAMES.has(roleName.trim())
}

export function getRoleDisplayLabel(roleName: string): string {
  if (roleName === 'Van Driver') return 'Van Driver (Transport)'
  return roleName
}

/** Compact labels for role filter tabs (fits page without horizontal scroll). */
export function getRoleTabLabel(roleName: string): string {
  const compact: Record<string, string> = {
    'All Users': 'All Users',
    'School Admin': 'School Admin',
    'Branch Admin': 'Branch Admin',
    'Branch In Charge': 'In Charge',
    'Attendance Master': 'Att. Master',
    'Attendance Operator': 'Att. Operator',
    'Lab Assistant': 'Lab Asst.',
    Receptionist: 'Reception',
    Principal: 'Principal',
    Teacher: 'Teacher',
    Accountant: 'Accountant',
    'Van Driver': 'Van Driver',
    Parent: 'Parent',
  }
  return compact[roleName] || roleName
}
