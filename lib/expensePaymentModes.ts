export const EXPENSE_PAYMENT_MODES = [
  'Cash',
  'Cheque',
  'UPI',
  'Card',
  'Bank Transfer',
] as const

export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[number]

export function normalizeExpensePaymentMode(mode?: string | null): ExpensePaymentMode | string {
  const raw = (mode || '').trim()
  if (!raw) return 'Cash'

  const lower = raw.toLowerCase()
  if (lower === 'upi' || lower === 'online') return 'UPI'

  const match = EXPENSE_PAYMENT_MODES.find((option) => option.toLowerCase() === lower)
  return match || raw
}

export function getExpensePaymentModeOptions(savedMode?: string | null): string[] {
  const modes: string[] = [...EXPENSE_PAYMENT_MODES]
  const normalized = savedMode ? normalizeExpensePaymentMode(savedMode) : ''
  if (normalized && !modes.includes(normalized)) {
    modes.push(normalized)
  }
  return modes
}
