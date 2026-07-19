/** Mirrors server ROLE_FEATURES → menu paths */
export const MENU_PATH_BY_FEATURE: Record<string, string> = {
  attendance: '/attendance',
  students: '/students',
  exams: '/exams',
  timetable: '/timetable',
  reports: '/reports',
  leaves: '/leaves',
}

export const BASE_TEACHER_PATHS = ['/dashboard', '/leaves']

export const ROLE_FEATURES: Record<string, string[]> = {
  'Class Teacher': ['attendance', 'students', 'reports', 'leaves'],
  'Subject Teacher': ['attendance', 'exams', 'timetable', 'reports', 'leaves'],
  Incharge: ['attendance', 'reports', 'leaves'],
  'Co-curricular Incharge': ['reports', 'leaves'],
  'Exam Incharge': ['exams', 'reports', 'leaves'],
  'Lab Incharge': ['exams', 'timetable', 'reports', 'leaves'],
  'Non Teaching Staff': ['leaves'],
}

export function featuresForRoleTypes(roleTypes: string[]): string[] {
  const features = new Set<string>(['dashboard'])
  roleTypes.forEach((role) => {
    ;(ROLE_FEATURES[role] || []).forEach((f) => features.add(f))
  })
  return Array.from(features)
}
