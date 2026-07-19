export type IdFormatType = 'employee' | 'student'

export const ID_FORMAT_TYPES: {
  id: IdFormatType
  label: string
  description: string
  defaultPrefix: string
  defaultTemplate: string
}[] = [
  {
    id: 'employee',
    label: 'Employee ID',
    description: 'Auto-generated for teachers when employee ID is left blank.',
    defaultPrefix: 'EMP',
    defaultTemplate: '{YEAR}{PREFIX}{SEQ:4}',
  },
  {
    id: 'student',
    label: 'Admission Number',
    description: 'Auto-generated admission number when adding or importing students (if left blank).',
    defaultPrefix: 'STU',
    defaultTemplate: '{YEAR}{PREFIX}{SEQ:4}',
  },
]

export function getIdFormatTypeMeta(idType: IdFormatType) {
  return ID_FORMAT_TYPES.find((t) => t.id === idType) || ID_FORMAT_TYPES[0]
}
