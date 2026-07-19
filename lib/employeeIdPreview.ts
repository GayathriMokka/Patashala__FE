export function renderEmployeeIdPreview(
  template: string,
  options: {
    prefix: string
    schoolCode?: string
    branchCode?: string
    year?: string
    academicYearStart?: string
    sequence: number
    sequencePadding?: number
  }
): string {
  const year = options.year || options.academicYearStart || String(new Date().getFullYear())
  const academicYearStart = options.academicYearStart || year
  const branchCode = options.branchCode || options.schoolCode || 'SCH'
  const paddingMatch = template.match(/\{SEQ:(\d+)\}/i)
  const padding = paddingMatch
    ? Math.min(Math.max(parseInt(paddingMatch[1], 10), 1), 10)
    : options.sequencePadding || 4
  const sequenceValue = String(options.sequence).padStart(padding, '0')

  return template
    .replace(/\{PREFIX\}/gi, options.prefix || 'EMP')
    .replace(/\{BRANCH\}/gi, branchCode)
    .replace(/\{SCHOOL\}/gi, branchCode)
    .replace(/\{YEAR\}/gi, year)
    .replace(/\{AY\}/gi, academicYearStart)
    .replace(/\{SEQ:\d+\}/gi, sequenceValue)
    .replace(/\{SEQ\}/gi, sequenceValue)
}

export function isValidEmployeeIdTemplate(template: string): boolean {
  return /\{SEQ(?::\d+)?\}/i.test(template)
}
