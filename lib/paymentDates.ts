/** Parse API/DB payment_date for <input type="date"> (YYYY-MM-DD, no timezone shift) */
export function parsePaymentDateForInput(value: string | Date | null | undefined): string {
  if (!value) return localDateString()
  const str = String(value)
  const dateOnly = str.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) return dateOnly[1]
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return localDateString()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatPaymentDateDisplay(value: string | Date | null | undefined): string {
  const iso = parsePaymentDateForInput(value)
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`
}

/** Display date as DD/MM/YYYY */
export function formatDateDDMMYYYY(value: string | Date | null | undefined): string {
  const iso = parsePaymentDateForInput(value)
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** True when YYYY-MM-DD is a real calendar date */
export function isValidCalendarIsoDate(iso: string): boolean {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

/** Parse DD/MM/YYYY (or DD-MM-YYYY) to YYYY-MM-DD for API / form state */
export function parseDDMMYYYYToISO(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidCalendarIsoDate(trimmed) ? trimmed : null
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return isValidCalendarIsoDate(iso) ? iso : null
}

/** Keep only date digits (max 8 for DDMMYYYY) */
export function digitsOnlyDateInput(value: string, maxLen = 8): string {
  return value.replace(/\D/g, '').slice(0, maxLen)
}

/** Format digit string as DD/MM/YYYY while typing */
export function formatDdMmYyyyFromDigits(digits: string): string {
  const d = digitsOnlyDateInput(digits)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Auto-insert slashes from typed or pasted input */
export function normalizeDdMmYyyyInput(raw: string): string {
  return formatDdMmYyyyFromDigits(raw)
}

export function normalizePaymentDateForApi(value: string): string {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : trimmed
}

function localDateString() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
