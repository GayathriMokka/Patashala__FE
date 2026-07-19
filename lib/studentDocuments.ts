import { getStudentPhotoUrl } from '@/lib/studentPhoto'

export type StudentDocumentType =
  | 'student_aadhaar'
  | 'father_aadhaar'
  | 'mother_aadhaar'
  | 'dob_certificate'
  | 'vaccination_certificate'

export const STUDENT_DOCUMENT_TYPES: StudentDocumentType[] = [
  'student_aadhaar',
  'father_aadhaar',
  'mother_aadhaar',
  'dob_certificate',
  'vaccination_certificate',
]

export const STUDENT_DOCUMENT_LABELS: Record<StudentDocumentType, string> = {
  student_aadhaar: 'Student Aadhaar Card',
  father_aadhaar: "Father's Aadhaar Card",
  mother_aadhaar: "Mother's Aadhaar Card",
  dob_certificate: 'Date of Birth Certificate',
  vaccination_certificate: 'Vaccination Certificate',
}

export type StudentDocumentSlot = {
  file: File | null
  previewUrl: string | null
  existingUrl: string | null
  remove: boolean
}

export type StudentDocumentsState = Record<StudentDocumentType, StudentDocumentSlot>

export function createEmptyDocumentsState(): StudentDocumentsState {
  return STUDENT_DOCUMENT_TYPES.reduce((acc, type) => {
    acc[type] = { file: null, previewUrl: null, existingUrl: null, remove: false }
    return acc
  }, {} as StudentDocumentsState)
}

const ALLOWED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024

export function validateStudentDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return 'Please upload a JPEG, PNG, GIF, WebP image, or PDF.'
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return 'Document must be 8 MB or smaller.'
  }
  return null
}

export function getStudentDocumentUrl(path: string | null | undefined): string | null {
  return getStudentPhotoUrl(path)
}

export function documentsFromStudent(student: {
  admission_form_data?: { documents?: Partial<Record<StudentDocumentType, string>> } | null
}): StudentDocumentsState {
  const base = createEmptyDocumentsState()
  const saved = student?.admission_form_data?.documents
  if (!saved) return base

  STUDENT_DOCUMENT_TYPES.forEach((type) => {
    const url = saved[type]
    if (url) {
      base[type] = {
        file: null,
        previewUrl: getStudentDocumentUrl(url),
        existingUrl: url,
        remove: false,
      }
    }
  })

  return base
}

export function revokeDocumentPreviews(state: StudentDocumentsState) {
  STUDENT_DOCUMENT_TYPES.forEach((type) => {
    const preview = state[type].previewUrl
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview)
    }
  })
}
