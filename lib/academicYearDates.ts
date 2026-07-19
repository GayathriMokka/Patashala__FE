export type AcademicYearDateScope = {
  start_date?: string | null
  end_date?: string | null
} | null | undefined

export function parseIsoDateOnly(value: string | null | undefined): string | null {
  if (!value) return null
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

export function localTodayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today clamped inside the selected academic year's start/end dates. */
export function getAcademicYearScopedToday(academicYear?: AcademicYearDateScope): string {
  const today = localTodayIso()
  const start = parseIsoDateOnly(academicYear?.start_date)
  const end = parseIsoDateOnly(academicYear?.end_date)

  if (start && today < start) return start
  if (end && today > end) return end
  return today
}

export function getAcademicYearDateBounds(academicYear?: AcademicYearDateScope) {
  return {
    min: parseIsoDateOnly(academicYear?.start_date) || undefined,
    max: parseIsoDateOnly(academicYear?.end_date) || undefined,
  }
}

/** Default filter range: both From and To set to today within the academic year. */
export function getDefaultAcademicYearDateRange(academicYear?: AcademicYearDateScope) {
  const today = getAcademicYearScopedToday(academicYear)
  return { dateFrom: today, dateTo: today }
}
