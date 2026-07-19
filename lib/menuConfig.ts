/**
 * Sidebar menu — paths align with backend featureCatalog MENU_PATH_MODULES.
 * Feature-managed roles filter via SchoolFeaturesContext.menuPaths.
 * Legacy roles (Parent, drivers, attendance kiosk) use legacyRoles fallback.
 */

export type AppMenuItem = {
  name: string
  path: string
  /** Roles that see this item when not using the feature-permission system */
  legacyRoles: string[]
}

export const APP_MENU_ITEMS: AppMenuItem[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    legacyRoles: [
      'Super Admin',
      'School Admin',
      'Principal',
      'Teacher',
      'Accountant',
      'Van Driver',
      'Parent',
      'Attendance Master',
      'Branch In Charge',
      'Branch Admin',
    ],
  },
  { name: 'Schools', path: '/schools', legacyRoles: ['Super Admin'] },
  {
    name: 'Students',
    path: '/students',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Teachers',
    path: '/teachers',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Attendance',
    path: '/attendance',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Face Capture',
    path: '/face-capture',
    legacyRoles: ['Attendance Master', 'Attendance Operator'],
  },
  {
    name: 'Exams',
    path: '/exams',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Timetable',
    path: '/timetable',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Transport',
    path: '/transport',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Van Driver', 'Driver', 'Parent', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Master Data',
    path: '/master-data',
    legacyRoles: ['Super Admin', 'School Admin', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Fees',
    path: '/fees',
    legacyRoles: ['Super Admin', 'School Admin', 'Accountant', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Collections',
    path: '/ex-payments',
    legacyRoles: ['Super Admin', 'School Admin', 'Accountant', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Revenue',
    path: '/revenue',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Accountant', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Expenses',
    path: '/expenses',
    legacyRoles: ['Super Admin', 'School Admin', 'Accountant', 'Teacher', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Assets',
    path: '/assets',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Salaries',
    path: '/salaries',
    legacyRoles: ['Super Admin', 'School Admin', 'Accountant', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Leaves',
    path: '/leaves',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Accountant', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Reports',
    path: '/reports',
    legacyRoles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Accountant', 'Branch In Charge', 'Branch Admin'],
  },
  {
    name: 'Users',
    path: '/users',
    legacyRoles: ['Super Admin', 'School Admin', 'Branch In Charge', 'Branch Admin'],
  },
  { name: 'Features', path: '/features', legacyRoles: ['School Admin'] },
]

/** Roles whose sidebar is driven by admin-granted feature permissions (not legacy role lists). */
export const LEGACY_MENU_ROLES = new Set([
  'Parent',
  'Van Driver',
  'Driver',
  'Attendance Master',
  'Attendance Operator',
])

export function usesFeaturePermissions(roleName?: string | null): boolean {
  if (!roleName || roleName === 'Super Admin') return false
  return !LEGACY_MENU_ROLES.has(roleName)
}
