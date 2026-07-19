export type EnrollmentLevel = '' | 'Toddler' | 'Nursery' | 'PP-1' | 'PP-2'
export type EnglishExposure = '' | 'both_parents_conversant' | 'familiar_with_language'
export type DeclarationSignatory = 'father' | 'mother' | 'guardian'

export interface AddressBlock {
  address: string
  pin: string
  telephone: string
  mobile: string
  email: string
}

export interface ParentParticulars {
  name: string
  qualification: string
  occupation: string
  organization: string
  office_address: string
  office_telephone: string
  mobile: string
  email: string
}

export interface EmergencyContact {
  name: string
  relation: string
  occupation: string
  address: string
  mobile: string
}

export interface SiblingInfo {
  name_age: string
  gender: string
  school: string
  class_name: string
  year_of_joining: string
}

export interface ReferBuddy {
  child_name: string
  age: string
  parent_name: string
  father_mother_name: string
  contact_no: string
  relation_type: '' | 'relatives' | 'acquaintances'
}

export interface PreschoolAdmissionData {
  date_of_admission: string
  age_years: string
  age_months: string
  age_days: string
  enrollment_level: EnrollmentLevel
  permanent_address: AddressBlock
  communication_address: AddressBlock
  health_complications: string
  allergies: string
  medication: string
  mother_tongue: string
  communication_skills: string
  english_exposure: EnglishExposure
  father: ParentParticulars
  mother: ParentParticulars
  emergency_contacts: EmergencyContact[]
  siblings: SiblingInfo[]
  other_siblings_info: string
  declaration_signatory: DeclarationSignatory
  declaration_date: string
  declaration_place: string
  declaration_signature: string
  office_registration_date: string
  office_due_date: string
  office_remarks: string
  office_admission_granted: string
  office_counsellor_signature: string
  refer_buddy: ReferBuddy
  photo_permission_consent: boolean
  photo_permission_signature_date: string
}

const emptyAddress = (): AddressBlock => ({
  address: '',
  pin: '',
  telephone: '',
  mobile: '',
  email: '',
})

const emptyParent = (): ParentParticulars => ({
  name: '',
  qualification: '',
  occupation: '',
  organization: '',
  office_address: '',
  office_telephone: '',
  mobile: '',
  email: '',
})

const emptyEmergency = (): EmergencyContact => ({
  name: '',
  relation: '',
  occupation: '',
  address: '',
  mobile: '',
})

const emptySibling = (): SiblingInfo => ({
  name_age: '',
  gender: '',
  school: '',
  class_name: '',
  year_of_joining: '',
})

export const defaultPreschoolAdmissionData = (): PreschoolAdmissionData => ({
  date_of_admission: new Date().toISOString().slice(0, 10),
  age_years: '',
  age_months: '',
  age_days: '',
  enrollment_level: '',
  permanent_address: emptyAddress(),
  communication_address: emptyAddress(),
  health_complications: '',
  allergies: '',
  medication: '',
  mother_tongue: '',
  communication_skills: '',
  english_exposure: '',
  father: emptyParent(),
  mother: emptyParent(),
  emergency_contacts: [emptyEmergency(), emptyEmergency()],
  siblings: [emptySibling(), emptySibling()],
  other_siblings_info: '',
  declaration_signatory: 'father',
  declaration_date: '',
  declaration_place: '',
  declaration_signature: '',
  office_registration_date: '',
  office_due_date: '',
  office_remarks: '',
  office_admission_granted: '',
  office_counsellor_signature: '',
  refer_buddy: {
    child_name: '',
    age: '',
    parent_name: '',
    father_mother_name: '',
    contact_no: '',
    relation_type: '',
  },
  photo_permission_consent: false,
  photo_permission_signature_date: '',
})

export function computeAgeFromDob(
  dob: string,
  asOf: Date = new Date()
): { years: number; months: number; days: number } | null {
  if (!dob) return null
  const birth = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date(asOf)
  today.setHours(0, 0, 0, 0)
  birth.setHours(0, 0, 0, 0)

  if (birth > today) return null

  let years = today.getFullYear() - birth.getFullYear()
  let months = today.getMonth() - birth.getMonth()
  let days = today.getDate() - birth.getDate()

  if (days < 0) {
    months -= 1
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  }
}

export function formatAgeLabelFromDob(dob: string, asOf: Date = new Date()): string {
  const age = computeAgeFromDob(dob, asOf)
  if (!age) return ''

  const parts: string[] = []
  if (age.years > 0) {
    parts.push(`${age.years} Year${age.years === 1 ? '' : 's'}`)
  }
  if (age.months > 0) {
    parts.push(`${age.months} Month${age.months === 1 ? '' : 's'}`)
  }
  if (age.days > 0 || parts.length === 0) {
    parts.push(`${age.days} Day${age.days === 1 ? '' : 's'}`)
  }

  return parts.join(', ')
}

export function mergeStudentIntoPreschoolData(
  student: Record<string, unknown>,
  existing?: PreschoolAdmissionData | null
): PreschoolAdmissionData {
  const base = existing || defaultPreschoolAdmissionData()
  const formData = (student.admission_form_data || {}) as Partial<PreschoolAdmissionData>

  return {
    ...base,
    ...formData,
    date_of_admission:
      (formData.date_of_admission as string) ||
      (student.admission_date ? String(student.admission_date).slice(0, 10) : base.date_of_admission),
    permanent_address: {
      ...base.permanent_address,
      ...(formData.permanent_address || {}),
      address: String(student.address || formData.permanent_address?.address || ''),
      pin: String(student.pincode || formData.permanent_address?.pin || ''),
      mobile: String(student.phone || formData.permanent_address?.mobile || ''),
      email: String(student.email || formData.permanent_address?.email || ''),
    },
    communication_address: {
      ...base.communication_address,
      ...(formData.communication_address || {}),
    },
    father: {
      ...base.father,
      ...(formData.father || {}),
      name: String(student.father_name || formData.father?.name || ''),
      mobile: String(student.father_phone || formData.father?.mobile || ''),
      email: String(student.father_email || formData.father?.email || ''),
      occupation: String(student.father_occupation || formData.father?.occupation || ''),
    },
    mother: {
      ...base.mother,
      ...(formData.mother || {}),
      name: String(student.mother_name || formData.mother?.name || ''),
      mobile: String(student.mother_phone || formData.mother?.mobile || ''),
      email: String(student.mother_email || formData.mother?.email || ''),
      occupation: String(student.mother_occupation || formData.mother?.occupation || ''),
    },
    emergency_contacts:
      formData.emergency_contacts?.length === 2
        ? formData.emergency_contacts
        : base.emergency_contacts,
    siblings:
      formData.siblings?.length === 2 ? formData.siblings : base.siblings,
    refer_buddy: { ...base.refer_buddy, ...(formData.refer_buddy || {}) },
  }
}

export function buildPreschoolSubmitPayload(
  baseForm: Record<string, unknown>,
  preschool: PreschoolAdmissionData,
  extra: { middle_name?: string; aadhaar_number?: string; place_of_birth?: string }
): Record<string, unknown> {
  const { father, mother, permanent_address, communication_address, ...restPreschool } = preschool

  return {
    ...baseForm,
    middle_name: extra.middle_name || '',
    aadhaar_number: extra.aadhaar_number || '',
    place_of_birth: extra.place_of_birth || '',
    address: permanent_address.address || baseForm.address,
    pincode: permanent_address.pin || baseForm.pincode,
    phone: permanent_address.mobile || baseForm.phone,
    email: permanent_address.email || baseForm.email,
    father_name: father.name || baseForm.father_name,
    father_phone: father.mobile || baseForm.father_phone,
    father_email: father.email || '',
    father_occupation: father.occupation || '',
    mother_name: mother.name || baseForm.mother_name,
    mother_phone: mother.mobile || baseForm.mother_phone,
    mother_email: mother.email || '',
    mother_occupation: mother.occupation || '',
    admission_date: preschool.date_of_admission || '',
    admission_form_data: (() => {
      const dob = String(baseForm.date_of_birth || '')
      const age = computeAgeFromDob(dob)
      return {
        ...restPreschool,
        father,
        mother,
        permanent_address,
        communication_address,
        age_years: age ? String(age.years) : '',
        age_months: age ? String(age.months) : '',
        age_days: age ? String(age.days) : '',
        age_as_of: new Date().toISOString().slice(0, 10),
        age_label: formatAgeLabelFromDob(dob),
      }
    })(),
  }
}

export const ENROLLMENT_LEVELS: { value: EnrollmentLevel; label: string; ageRange: string }[] = [
  { value: 'Toddler', label: 'Toddler', ageRange: '1.5 - 2.5 Yrs' },
  { value: 'Nursery', label: 'Nursery', ageRange: '2.5 - 3.5 Yrs' },
  { value: 'PP-1', label: 'PP-1', ageRange: '3.5 - 4.5 Yrs' },
  { value: 'PP-2', label: 'PP-2', ageRange: '4.5 - 5.5 Yrs' },
]

export function matchClassIdForEnrollment(
  level: EnrollmentLevel,
  classes: { id: number; name: string }[] | undefined
): string {
  if (!level || !classes?.length) return ''
  const normalized = level.toLowerCase().replace(/\s+/g, '')
  const match = classes.find((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '')
    return name === normalized || name.includes(normalized) || normalized.includes(name)
  })
  return match ? String(match.id) : ''
}
