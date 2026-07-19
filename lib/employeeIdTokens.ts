export const EMPLOYEE_ID_TOKENS = [
  { token: '{PREFIX}', description: 'Custom prefix (e.g. EMP, STU)' },
  { token: '{BRANCH}', description: 'Selected branch code (e.g. FOW-KXP)' },
  { token: '{SCHOOL}', description: 'Same as branch code when a branch is selected' },
  { token: '{YEAR}', description: 'Academic year start year (e.g. 2026 from 2026-27)' },
  { token: '{AY}', description: 'Academic year start year (alias of {YEAR})' },
  { token: '{SEQ}', description: 'Auto-increment number with default padding' },
  { token: '{SEQ:4}', description: 'Auto-increment with fixed digit padding' },
] as const

export const DEFAULT_EMPLOYEE_ID_FORMAT = '{SCHOOL}-{PREFIX}-{SEQ:4}'
