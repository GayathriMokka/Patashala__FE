const PRESCHOOL_CLASS_PATTERNS = [
  'toddler',
  'nursery',
  'pp-1',
  'pp-2',
  'pp1',
  'pp2',
  'pre-school',
  'preschool',
  'pre school',
  'playgroup',
  'play group',
  'kg',
  'lkg',
  'ukg',
]

function normalizeSchoolType(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

function isPreschoolType(value?: string | null): boolean {
  const normalized = normalizeSchoolType(value)
  return normalized === 'preschool' || normalized === 'pre-school' || normalized === 'pre school'
}

function classNameLooksPreschool(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return PRESCHOOL_CLASS_PATTERNS.some(
    (pattern) => normalized === pattern || normalized.includes(pattern)
  )
}

export function isPreschoolContext(options: {
  branch?: { school_type?: string | null } | null
  branches?: { school_type?: string | null }[]
  classes?: { name: string }[]
  schoolType?: string | null
  isAllBranches?: boolean
}): boolean {
  if (isPreschoolType(options.schoolType)) return true
  if (isPreschoolType(options.branch?.school_type)) return true

  if (options.isAllBranches && options.branches?.some((b) => isPreschoolType(b.school_type))) {
    return true
  }

  if (options.classes?.some((cls) => classNameLooksPreschool(cls.name))) {
    return true
  }

  return false
}
