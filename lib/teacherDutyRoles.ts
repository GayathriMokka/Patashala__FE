export const TEACHER_DUTY_ROLES = [
  'Class Teacher',
  'Subject Teacher',
  'Incharge',
  'Co-curricular Incharge',
  'Exam Incharge',
  'Lab Incharge',
  'Non Teaching Staff',
] as const

export type TeacherDutyRole = (typeof TEACHER_DUTY_ROLES)[number]

export function roleNeedsClassSection(role: string): boolean {
  return role === 'Class Teacher'
}

export function roleNeedsSubject(role: string): boolean {
  return role === 'Subject Teacher' || role === 'Lab Incharge'
}

export function formatRoleAssignmentLabel(assignment: {
  role_type: string
  class_name?: string | null
  section_name?: string | null
  subject_name?: string | null
  remarks?: string | null
}): string {
  const parts = [assignment.role_type]
  if (assignment.class_name) {
    parts.push(
      assignment.section_name
        ? `${assignment.class_name}-${assignment.section_name}`
        : assignment.class_name
    )
  }
  if (assignment.subject_name) {
    parts.push(assignment.subject_name)
  }
  if (assignment.remarks?.includes('Synced from')) {
    parts.push('(auto)')
  }
  return parts.join(' · ')
}
