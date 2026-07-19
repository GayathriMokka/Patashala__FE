export const TEACHER_IMPORT_COLUMNS = [
  'Employee ID',
  'Name',
  'Email',
  'Password',
  'Phone',
  'Qualification',
  'Specialization',
  'Experience Years',
  'Joining Date',
] as const

const SAMPLE_ROW: Record<(typeof TEACHER_IMPORT_COLUMNS)[number], string> = {
  'Employee ID': '',
  Name: 'Priya Reddy',
  Email: 'priya.reddy@example.com',
  Password: 'Teacher@123',
  Phone: '9876543210',
  Qualification: 'B.Ed',
  Specialization: 'Mathematics',
  'Experience Years': '5',
  'Joining Date': '2026-06-01',
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildTeacherImportTemplateCsv(): string {
  const header = TEACHER_IMPORT_COLUMNS.join(',')
  const sample = TEACHER_IMPORT_COLUMNS.map((col) => escapeCsvValue(SAMPLE_ROW[col])).join(',')
  return `\uFEFF${header}\n${sample}\n`
}

export function downloadTeacherImportTemplate(filename = 'teacher_import_template.csv'): void {
  const csv = buildTeacherImportTemplateCsv()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
