/** Master Data sub-tabs mapped to Feature Management keys (backend featureCatalog). */

export const MASTER_DATA_TAB_FEATURES: Record<string, string> = {
  branches: 'master_data.branch_management',
  'academic-years': 'master_data.academic_years',
  classes: 'master_data.classes',
  sections: 'master_data.sections',
  subjects: 'master_data.subjects',
  'teacher-roles': 'master_data.teacher_roles',
  id: 'master_data.classes',
  billing: 'master_data.billing',
  coupon: 'master_data.coupons',
  expenses: 'master_data.expenses_setup',
  assets: 'master_data.assets_setup',
  'ex-payments': 'master_data.billing',
  leave: 'master_data.leave_setup',
  'exam-types': 'exams.schedule',
  transport: 'master_data.transport_setup',
  'face-registration': 'master_data.face_registration',
}

export const MASTER_DATA_TAB_LABELS: Record<string, string> = {
  branches: 'Branch Management',
  'academic-years': 'Academic Years',
  classes: 'Classes',
  sections: 'Sections',
  subjects: 'Subjects',
  'teacher-roles': 'Teacher Roles',
  id: 'ID',
  billing: 'Billing',
  coupon: 'Coupon',
  expenses: 'Expenses',
  assets: 'Assets',
  'ex-payments': 'Collections',
  leave: 'Leave',
  'exam-types': 'Exam Names',
  transport: 'Transport',
  'face-registration': 'Face Registration',
}

/** Compact labels for the Master Data left sidebar */
export const MASTER_DATA_TAB_SHORT_LABELS: Record<string, string> = {
  branches: 'Branches',
  'academic-years': 'Years',
  classes: 'Classes',
  sections: 'Sections',
  subjects: 'Subjects',
  'teacher-roles': 'Roles',
  id: 'ID',
  billing: 'Billing',
  coupon: 'Coupons',
  expenses: 'Expenses',
  assets: 'Assets',
  'ex-payments': 'Collections',
  leave: 'Leave',
  'exam-types': 'Exams',
  transport: 'Transport',
  'face-registration': 'Face ID',
}

const TRANSPORT_LEGACY_FEATURES = [
  'master_data.transport_setup',
  'master_data.vans_setup',
  'master_data.trips_setup',
]

export function canAccessMasterDataTab(
  tab: string,
  hasFeature: (key: string) => boolean,
  isSuperAdmin?: boolean
): boolean {
  if (isSuperAdmin) return true
  if (tab === 'transport') {
    return TRANSPORT_LEGACY_FEATURES.some((key) => hasFeature(key))
  }
  const featureKey = MASTER_DATA_TAB_FEATURES[tab]
  if (!featureKey) return false
  return hasFeature(featureKey)
}

export function getVisibleMasterDataTabs(
  tabIds: readonly string[],
  hasFeature: (key: string) => boolean,
  isSuperAdmin?: boolean
): string[] {
  return tabIds.filter((tab) => canAccessMasterDataTab(tab, hasFeature, isSuperAdmin))
}

/** Sidebar groups for Master Data left navigation */
export const MASTER_DATA_TAB_GROUPS: { id: string; label: string; tabs: string[] }[] = [
  { id: 'org', label: 'Organization', tabs: ['branches', 'academic-years'] },
  { id: 'academic', label: 'Academic', tabs: ['classes', 'sections', 'subjects', 'teacher-roles', 'id'] },
  { id: 'finance', label: 'Finance', tabs: ['billing', 'coupon', 'expenses', 'ex-payments'] },
  {
    id: 'operations',
    label: 'Operations',
    tabs: ['assets', 'leave', 'exam-types', 'transport', 'face-registration'],
  },
]

export function getGroupedVisibleMasterTabs(
  visibleTabs: string[]
): { label: string; tabs: string[] }[] {
  const visible = new Set(visibleTabs)
  return MASTER_DATA_TAB_GROUPS.map((group) => ({
    label: group.label,
    tabs: group.tabs.filter((tab) => visible.has(tab)),
  })).filter((group) => group.tabs.length > 0)
}
