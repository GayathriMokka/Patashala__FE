export const STUDENT_IMPORT_COLUMNS = [
  'First Name',
  'Admission Number',
  'Last Name',
  'Roll Number',
  'Date of Birth',
  'Gender',
  'Email',
  'Phone',
  'Address',
  'City',
  'State',
  'Pincode',
  'Father Name',
  'Father Phone',
  'Mother Name',
  'Mother Phone',
  'Total Amount (₹)',
] as const

const SAMPLE_ROW: Record<(typeof STUDENT_IMPORT_COLUMNS)[number], string> = {
  'Admission Number': '',
  'First Name': 'Rahul',
  'Last Name': 'Sharma',
  'Roll Number': '1',
  'Date of Birth': '2015-05-15',
  Gender: 'Male',
  Email: 'rahul.sharma@example.com',
  Phone: '9876543210',
  Address: '123 Main Street',
  City: 'Hyderabad',
  State: 'Telangana',
  Pincode: '500001',
  'Father Name': 'Rajesh Sharma',
  'Father Phone': '9876543211',
  'Mother Name': 'Priya Sharma',
  'Mother Phone': '9876543212',
  'Total Amount (₹)': '35000',
}

function escapeCsvValue(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildStudentImportTemplateCsv(): string {
  const header = STUDENT_IMPORT_COLUMNS.join(',')
  const sample = STUDENT_IMPORT_COLUMNS.map((col) => escapeCsvValue(SAMPLE_ROW[col])).join(',')
  return `\uFEFF${header}\n${sample}\n`
}

export function downloadStudentImportTemplate(
  className?: string,
  sectionName?: string,
  academicYearName?: string,
  filename?: string
): void {
  const safeYear = (academicYearName || 'year').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
  const safeClass = (className || 'class').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
  const safeSection = (sectionName || 'section').replace(/[^\w\s-]/g, '').trim()
  const defaultFilename = `student_import_${safeYear}_${safeClass}_${safeSection}.csv`
  const csv = buildStudentImportTemplateCsv()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || defaultFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
