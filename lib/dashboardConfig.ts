/**
 * Role-based dashboard — stats, copy, and quick actions aligned with Layout menu access.
 */

import {
  canCollectFees,
  canManageStudents,
  canMarkAttendance,
} from '@/lib/rolePermissions'
import { canViewRevenue } from '@/lib/revenueAccess'
import { usesFeaturePermissions } from '@/lib/menuConfig'
import { formatMoney } from '@/lib/formatMoney'

export type DashboardStatId = 'students' | 'teachers' | 'classes' | 'fee_collection' | 'branches'

export type DashboardQuickActionId =
  | 'add-student'
  | 'mark-attendance'
  | 'collect-fee'
  | 'reports'
  | 'leaves'
  | 'expenses'
  | 'salaries'
  | 'timetable'
  | 'exams'
  | 'transport'
  | 'face-capture'
  | 'master-data'
  | 'users'
  | 'schools'

/** Maps quick actions to admin-granted feature keys (Feature Management). */
export const QUICK_ACTION_FEATURE_KEYS: Partial<Record<DashboardQuickActionId, string>> = {
  'add-student': 'dashboard.add_student_shortcut',
  'mark-attendance': 'dashboard.mark_attendance_shortcut',
  'collect-fee': 'dashboard.collect_fee_shortcut',
  reports: 'dashboard.reports_shortcut',
  leaves: 'dashboard.leave_shortcut',
  expenses: 'dashboard.expenses_shortcut',
  salaries: 'dashboard.salaries_shortcut',
  timetable: 'dashboard.timetable_shortcut',
  exams: 'dashboard.exams_shortcut',
  transport: 'dashboard.transport_shortcut',
  'master-data': 'dashboard.master_data_shortcut',
  users: 'dashboard.users_shortcut',
}

export type DashboardStatDef = {
  id: DashboardStatId
  label: string
  shortLabel: string
  accent: string
  iconBg: string
}

export const DASHBOARD_STAT_DEFS: Record<DashboardStatId, DashboardStatDef> = {
  students: {
    id: 'students',
    label: 'Total Students',
    shortLabel: 'Students',
    accent: 'text-blue-300',
    iconBg: 'bg-blue-500/25 text-blue-200 border border-blue-400/30',
  },
  teachers: {
    id: 'teachers',
    label: 'Total Teachers',
    shortLabel: 'Teachers',
    accent: 'text-violet-300',
    iconBg: 'bg-violet-500/25 text-violet-200 border border-violet-400/30',
  },
  classes: {
    id: 'classes',
    label: 'Total Classes',
    shortLabel: 'Classes',
    accent: 'text-emerald-300',
    iconBg: 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/30',
  },
  fee_collection: {
    id: 'fee_collection',
    label: 'Fee Collection',
    shortLabel: 'Fees collected',
    accent: 'text-amber-300',
    iconBg: 'bg-amber-500/25 text-amber-200 border border-amber-400/30',
  },
  branches: {
    id: 'branches',
    label: 'Total Branches',
    shortLabel: 'Branches',
    accent: 'text-cyan-300',
    iconBg: 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/30',
  },
}

export type DashboardQuickActionDef = {
  id: DashboardQuickActionId
  title: string
  description: string
  href: string
  /** Menu path used for Teacher duty filtering */
  path: string
  roles: readonly string[]
  /** Extra gate beyond role list */
  allowed?: (roleName: string) => boolean
}

export const QUICK_ACTION_DEFS: DashboardQuickActionDef[] = [
  {
    id: 'add-student',
    title: 'Add Student',
    description: 'Register a new student',
    href: '/students',
    path: '/students',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Teacher'],
    allowed: (role) => (role === 'Teacher' ? true : canManageStudents(role)),
  },
  {
    id: 'mark-attendance',
    title: 'Mark Attendance',
    description: 'Record student attendance',
    href: '/attendance',
    path: '/attendance',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Teacher'],
    allowed: (role) => canMarkAttendance(role),
  },
  {
    id: 'collect-fee',
    title: 'Collect Fee',
    description: 'Process fee payments',
    href: '/fees',
    path: '/fees',
    roles: ['Super Admin', 'School Admin', 'Accountant'],
    allowed: (role) => canCollectFees(role),
  },
  {
    id: 'reports',
    title: 'View Reports',
    description: 'Analytics and exports',
    href: '/reports',
    path: '/reports',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Accountant'],
  },
  {
    id: 'leaves',
    title: 'Leave Management',
    description: 'Apply or review leave requests',
    href: '/leaves',
    path: '/leaves',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Teacher', 'Accountant'],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    description: 'Track school expenditures',
    href: '/expenses',
    path: '/expenses',
    roles: ['Super Admin', 'School Admin', 'Accountant', 'Teacher'],
  },
  {
    id: 'salaries',
    title: 'Salaries',
    description: 'Payroll and salary structures',
    href: '/salaries',
    path: '/salaries',
    roles: ['Super Admin', 'School Admin', 'Accountant'],
  },
  {
    id: 'timetable',
    title: 'Timetable',
    description: 'Class schedules and periods',
    href: '/timetable',
    path: '/timetable',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Teacher'],
  },
  {
    id: 'exams',
    title: 'Exams',
    description: 'Exams and assessments',
    href: '/exams',
    path: '/exams',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Teacher'],
  },
  {
    id: 'transport',
    title: 'Transport',
    description: 'Routes and vehicle tracking',
    href: '/transport',
    path: '/transport',
    roles: ['Super Admin', 'School Admin', 'Principal', 'Van Driver', 'Driver', 'Parent'],
  },
  {
    id: 'face-capture',
    title: 'Face Capture',
    description: 'Staff check-in via face recognition',
    href: '/face-capture',
    path: '/face-capture',
    roles: ['Attendance Master', 'Attendance Operator'],
  },
  {
    id: 'master-data',
    title: 'Master Data',
    description: 'School configuration and setup',
    href: '/master-data',
    path: '/master-data',
    roles: ['Super Admin', 'School Admin'],
  },
  {
    id: 'users',
    title: 'Users',
    description: 'Manage staff accounts and roles',
    href: '/users',
    path: '/users',
    roles: ['Super Admin', 'School Admin'],
  },
  {
    id: 'schools',
    title: 'Schools',
    description: 'Multi-school administration',
    href: '/schools',
    path: '/schools',
    roles: ['Super Admin'],
  },
]

const OVERVIEW_ROLES = ['Super Admin', 'School Admin', 'Principal', 'Branch In Charge', 'Branch Admin'] as const
const OPERATIONS_ROLES = ['Teacher', 'Accountant'] as const

export function getDashboardTitle(roleName?: string | null): string {
  switch (roleName) {
    case 'Parent':
      return 'Family Portal'
    case 'Super Admin':
      return 'Platform Overview'
    case 'School Admin':
      return 'Administration Overview'
    case 'Principal':
      return 'Academic Leadership'
    case 'Branch In Charge':
      return 'Branch Operations'
    case 'Branch Admin':
      return 'Branch Administration'
    case 'Teacher':
      return 'Teaching Workspace'
    case 'Accountant':
      return 'Finance Overview'
    case 'Attendance Master':
    case 'Attendance Operator':
      return 'Attendance Station'
    case 'Van Driver':
    case 'Driver':
      return 'Transport Operations'
    default:
      return 'Dashboard'
  }
}

function isSameSchoolAndUserName(userName?: string, schoolName?: string): boolean {
  if (!userName?.trim() || !schoolName?.trim()) return false
  return userName.trim().toLowerCase() === schoolName.trim().toLowerCase()
}

export function getDashboardSubtitle(
  roleName: string | null | undefined,
  opts: { userName?: string; schoolName?: string }
): string {
  const school = opts.schoolName?.trim() || 'your institution'
  const userName = opts.userName?.trim()
  const namedUser = userName && !isSameSchoolAndUserName(userName, opts.schoolName) ? userName : null

  switch (roleName) {
    case 'Parent':
      return namedUser
        ? `Welcome, ${namedUser}. Stay connected with your children's progress at ${school}.`
        : `Stay connected with your children's progress, attendance, and school updates at ${school}.`
    case 'Super Admin':
      return namedUser
        ? `Welcome back, ${namedUser}. Oversee schools, subscriptions, and platform-wide configuration.`
        : 'Oversee schools, subscriptions, and platform-wide configuration from one place.'
    case 'School Admin':
      return namedUser
        ? `Welcome back, ${namedUser}. Your command centre for ${school} — enrolment, academics, finance, and operations in one view.`
        : `Your command centre for ${school}. Monitor performance, manage resources, and keep every branch running with clarity.`
    case 'Principal':
      return namedUser
        ? `Welcome back, ${namedUser}. Academic oversight and institutional leadership for ${school}.`
        : `Academic oversight and institutional leadership for ${school} — students, staff, and outcomes at a glance.`
    case 'Branch In Charge':
    case 'Branch Admin':
      return namedUser
        ? `Welcome back, ${namedUser}. Branch-level tools and daily operations for ${school}.`
        : `Branch-level tools and daily operations for ${school} — your local view of students, staff, and activity.`
    case 'Teacher':
      return namedUser
        ? `Welcome back, ${namedUser}. Your classes, attendance, and teaching tools for ${school}.`
        : `Your classes, attendance, and teaching tools for ${school} — everything you need for the day ahead.`
    case 'Accountant':
      return namedUser
        ? `Welcome back, ${namedUser}. Fees, collections, expenses, and payroll for ${school}.`
        : `Fees, collections, expenses, and payroll for ${school} — financial operations in one place.`
    case 'Attendance Master':
    case 'Attendance Operator':
      return namedUser
        ? `Welcome, ${namedUser}. Capture and verify staff attendance with face recognition.`
        : 'Capture and verify staff attendance with face recognition.'
    case 'Van Driver':
    case 'Driver':
      return namedUser
        ? `Welcome, ${namedUser}. Routes, vehicles, and transport coordination for ${school}.`
        : `Routes, vehicles, and transport coordination for ${school}.`
    default:
      return namedUser ? `Welcome back, ${namedUser}.` : 'Welcome back.'
  }
}

/** Polished label for the role badge on the dashboard header */
export function getRoleDisplayLabel(roleName?: string | null): string {
  switch (roleName) {
    case 'Super Admin':
      return 'Platform Administrator'
    case 'School Admin':
      return 'School Administrator'
    case 'Principal':
      return 'Principal'
    case 'Branch In Charge':
      return 'Branch In Charge'
    case 'Branch Admin':
      return 'Branch Administrator'
    case 'Teacher':
      return 'Teaching Staff'
    case 'Accountant':
      return 'Finance Team'
    case 'Parent':
      return 'Parent / Guardian'
    case 'Attendance Master':
      return 'Attendance Master'
    case 'Attendance Operator':
      return 'Attendance Operator'
    case 'Van Driver':
      return 'Transport Staff'
    case 'Driver':
      return 'Driver'
    default:
      return roleName || 'User'
  }
}

export function getRoleBadgeStyle(roleName?: string | null): string {
  switch (roleName) {
    case 'Super Admin':
      return 'bg-violet-500/25 text-violet-200 border-violet-400/30'
    case 'School Admin':
      return 'bg-blue-500/25 text-blue-200 border-blue-400/30'
    case 'Principal':
      return 'bg-indigo-500/25 text-indigo-200 border-indigo-400/30'
    case 'Branch In Charge':
    case 'Branch Admin':
      return 'bg-cyan-500/25 text-cyan-200 border-cyan-400/30'
    case 'Teacher':
      return 'bg-sky-500/25 text-sky-200 border-sky-400/30'
    case 'Accountant':
      return 'bg-amber-500/25 text-amber-200 border-amber-400/30'
    case 'Parent':
      return 'bg-rose-500/25 text-rose-200 border-rose-400/30'
    case 'Attendance Master':
    case 'Attendance Operator':
      return 'bg-teal-500/25 text-teal-200 border-teal-400/30'
    case 'Van Driver':
    case 'Driver':
      return 'bg-orange-500/25 text-orange-200 border-orange-400/30'
    default:
      return 'bg-white/15 text-white/80 border-white/25'
  }
}

/** Which stat cards to render per role */
export function getVisibleDashboardStats(roleName?: string | null): DashboardStatId[] {
  if (!roleName || roleName === 'Parent') return []

  if (roleName === 'Accountant') {
    const stats: DashboardStatId[] = ['students', 'classes']
    if (canViewRevenue(roleName)) stats.push('fee_collection')
    return stats
  }

  if (roleName === 'Teacher') {
    return ['students', 'classes']
  }

  if (
    roleName === 'Van Driver' ||
    roleName === 'Driver' ||
    roleName === 'Attendance Master' ||
    roleName === 'Attendance Operator'
  ) {
    return []
  }

  if (OVERVIEW_ROLES.includes(roleName as (typeof OVERVIEW_ROLES)[number])) {
    const stats: DashboardStatId[] = ['students', 'teachers', 'classes']
    if (roleName === 'School Admin') stats.unshift('branches')
    if (canViewRevenue(roleName)) stats.push('fee_collection')
    return stats
  }

  if (OPERATIONS_ROLES.includes(roleName as (typeof OPERATIONS_ROLES)[number])) {
    return ['students', 'classes']
  }

  return ['students', 'classes']
}

export function shouldFetchSchoolStats(roleName?: string | null): boolean {
  return getVisibleDashboardStats(roleName).length > 0
}

export function getDashboardQuickActions(
  roleName?: string | null,
  teacherMenuPaths?: string[],
  opts?: {
    hasFeature?: (key: string) => boolean
    canAccessPath?: (path: string) => boolean
  }
): DashboardQuickActionDef[] {
  if (!roleName) return []

  const hasFeature = opts?.hasFeature ?? (() => true)
  const canAccessPath = opts?.canAccessPath ?? (() => true)

  if (roleName === 'Parent') {
    return QUICK_ACTION_DEFS.filter((action) => action.roles.includes('Parent'))
  }

  if (roleName === 'Attendance Master' || roleName === 'Attendance Operator') {
    return QUICK_ACTION_DEFS.filter((action) => action.id === 'face-capture')
  }

  const featureManaged = usesFeaturePermissions(roleName)

  return QUICK_ACTION_DEFS.filter((action) => {
    const featureKey = QUICK_ACTION_FEATURE_KEYS[action.id]

    if (featureManaged) {
      if (featureKey && !hasFeature(featureKey)) return false
      if (!canAccessPath(action.path)) return false
      if (roleName === 'Teacher') {
        const paths =
          teacherMenuPaths && teacherMenuPaths.length > 0
            ? teacherMenuPaths
            : ['/dashboard', '/leaves']
        return paths.some((p) => action.path === p || action.path.startsWith(`${p}/`))
      }
      return true
    }

    if (!action.roles.includes(roleName)) return false
    if (action.allowed && !action.allowed(roleName)) return false
    if (featureKey && !hasFeature(featureKey)) return false
    if (!canAccessPath(action.path)) return false

    if (roleName === 'Teacher') {
      const paths =
        teacherMenuPaths && teacherMenuPaths.length > 0
          ? teacherMenuPaths
          : ['/dashboard', '/leaves']
      return paths.some((p) => action.path === p || action.path.startsWith(`${p}/`))
    }

    return true
  })
}

export function getBranchesStatDef(
  isAllBranches: boolean,
  branchName?: string | null
): DashboardStatDef {
  if (isAllBranches) {
    return DASHBOARD_STAT_DEFS.branches
  }
  return {
    ...DASHBOARD_STAT_DEFS.branches,
    label: branchName ? branchName : 'Selected branch',
    shortLabel: 'Branch',
  }
}

export function formatStatValue(
  statId: DashboardStatId,
  data?: {
    total_students?: number
    total_teachers?: number
    total_classes?: number
    total_branches?: number
    fee_collection?: number
    view_mode?: string
  } | null,
  opts?: { isAllBranches?: boolean }
): string {
  if (!data) return '—'
  switch (statId) {
    case 'students':
      return data.total_students != null ? String(data.total_students) : '—'
    case 'teachers':
      return data.total_teachers != null ? String(data.total_teachers) : '—'
    case 'classes':
      return data.total_classes != null ? String(data.total_classes) : '—'
    case 'branches':
      if (opts?.isAllBranches === false) return '1'
      return data.total_branches != null ? String(data.total_branches) : '—'
    case 'fee_collection':
      return data.fee_collection != null
        ? formatMoney(data.fee_collection, { compact: true })
        : '—'
    default:
      return '—'
  }
}
