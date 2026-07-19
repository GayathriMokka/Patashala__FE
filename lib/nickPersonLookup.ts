export type PersonRecord = {
  kind: 'teacher' | 'student'
  score: number
  displayName: string
  summary: string
}

const SYSTEM_KEYWORDS = [
  'module',
  'access',
  'permission',
  'summary',
  'report',
  'stats',
  'dashboard',
  'how to',
  'help me',
  'what can',
]

const NAME_INTENT_PATTERNS = [
  /^(?:please\s+)?(?:give\s+me\s+)?(?:the\s+)?details?\s+of\s+(?:the\s+)?(.+)$/i,
  /^(?:please\s+)?(?:show\s+me\s+)?(?:info(?:rmation)?\s+)?(?:about|on|for)\s+(?:the\s+)?(.+)$/i,
  /^who\s+is\s+(?:the\s+)?(.+)$/i,
  /^find\s+(?:the\s+)?(.+)$/i,
  /^search\s+(?:for\s+)?(?:the\s+)?(.+)$/i,
  /^(?:tell\s+me\s+about)\s+(?:the\s+)?(.+)$/i,
]

export function cleanPersonName(raw: string): string {
  return raw
    .replace(/^[,.:\s!?]+|[,.:\s!?]+$/g, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .trim()
}

export function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractPersonNameFromQuery(question: string): string | null {
  const normalized = question.trim()
  if (!normalized) return null

  for (const pattern of NAME_INTENT_PATTERNS) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      const cleaned = cleanPersonName(match[1])
      if (cleaned.length >= 2) return cleaned
    }
  }

  const lower = normalized.toLowerCase()
  if (SYSTEM_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return null
  }

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length >= 1 && words.length <= 5 && /[a-zA-Z]/.test(normalized)) {
    return cleanPersonName(normalized)
  }

  return null
}

export function scorePersonNameMatch(candidate: string, target: string): number {
  const c = normalizeNameForMatch(candidate)
  const t = normalizeNameForMatch(target)
  if (!c || !t) return 0
  if (c === t) return 100
  if (c.includes(t) || t.includes(c)) return 88

  const cParts = c.split(' ').filter((part) => part.length > 0)
  const tParts = t.split(' ').filter((part) => part.length > 0)
  const significantTargetParts = tParts.filter((part) => part.length >= 2)
  if (significantTargetParts.length > 0) {
    const allFound = significantTargetParts.every((targetPart) =>
      cParts.some(
        (candidatePart) =>
          candidatePart === targetPart ||
          candidatePart.includes(targetPart) ||
          targetPart.includes(candidatePart)
      )
    )
    if (allFound) return 78
  }

  if (tParts.length >= 2 && cParts.length >= 2) {
    const targetLast = tParts[tParts.length - 1]
    const candidateLast = cParts[cParts.length - 1]
    if (
      targetLast === candidateLast ||
      targetLast.includes(candidateLast) ||
      candidateLast.includes(targetLast)
    ) {
      const targetFirst = tParts.slice(0, -1)
      const candidateFirst = cParts.slice(0, -1)
      const firstMatch = targetFirst.some((tf) =>
        candidateFirst.some((cf) => cf === tf || cf.includes(tf) || tf.includes(cf))
      )
      if (firstMatch) return 72
    }
  }

  if (tParts.length === 1) {
    const hit = cParts.some((part) => part.includes(tParts[0]) || tParts[0].includes(part))
    if (hit) return 55
  }

  return 0
}

export function formatTeacherSummary(teacher: Record<string, unknown>): string {
  return `Teacher: ${teacher.name || 'N/A'} | ID: ${teacher.employee_id || 'N/A'} | Email: ${
    teacher.email || 'N/A'
  } | Phone: ${teacher.phone || 'N/A'} | Qualification: ${teacher.qualification || 'N/A'} | Experience: ${
    teacher.experience_years != null && teacher.experience_years !== ''
      ? `${teacher.experience_years} years`
      : 'N/A'
  } | Branch: ${teacher.branch_name || 'N/A'}`
}

export function formatStudentSummary(student: Record<string, unknown>): string {
  const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim()
  return `Student: ${fullName || 'N/A'} | Admission: ${student.admission_number || 'N/A'} | Class: ${
    student.class_name || 'N/A'
  } | Section: ${student.section_name || 'N/A'} | Parent: ${student.father_name || 'N/A'} | Phone: ${
    student.phone || student.father_phone || 'N/A'
  } | Status: ${student.status || 'N/A'}`
}

export function rankPersonMatches(
  nameQuery: string,
  teachers: Record<string, unknown>[],
  students: Record<string, unknown>[]
): PersonRecord[] {
  const matches: PersonRecord[] = []

  for (const teacher of teachers) {
    const displayName = String(teacher.name || '').trim()
    const score = scorePersonNameMatch(displayName, nameQuery)
    if (score > 0) {
      matches.push({
        kind: 'teacher',
        score,
        displayName,
        summary: formatTeacherSummary(teacher),
      })
    }
  }

  for (const student of students) {
    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim()
    const parentName = String(student.father_name || student.mother_name || '').trim()
    const score = Math.max(
      scorePersonNameMatch(fullName, nameQuery),
      parentName ? scorePersonNameMatch(parentName, nameQuery) : 0
    )
    if (score > 0) {
      matches.push({
        kind: 'student',
        score,
        displayName: fullName || parentName,
        summary: formatStudentSummary(student),
      })
    }
  }

  return matches.sort((a, b) => b.score - a.score)
}

export function buildPersonLookupReply(nameQuery: string, matches: PersonRecord[]): string {
  if (matches.length === 0) {
    return `I could not find "${nameQuery}" in the data you are allowed to access. Try full name spelling (example: S Vijetha Lakshmi).`
  }

  const best = matches[0]
  if (matches.length === 1 || best.score >= 85) {
    return best.summary
  }

  const topNames = matches
    .slice(0, 3)
    .map((match) => `${match.displayName} (${match.kind})`)
    .join(', ')
  return `${best.summary}\n\nOther close matches: ${topNames}`
}
