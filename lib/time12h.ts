export type Time12hParts = {
  hour: string
  minute: string
  period: 'AM' | 'PM'
}

export function parseTime24(time24: string | null | undefined): Time12hParts | null {
  if (!time24) return null
  const normalized = time24.slice(0, 5)
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  let hour24 = parseInt(match[1], 10)
  const minute = match[2]
  if (hour24 < 0 || hour24 > 23) return null

  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12

  return { hour: String(hour12), minute, period }
}

export function toTime24(parts: Time12hParts): string {
  let hour = parseInt(parts.hour, 10)
  if (parts.period === 'AM') {
    if (hour === 12) hour = 0
  } else if (hour !== 12) {
    hour += 12
  }
  return `${String(hour).padStart(2, '0')}:${parts.minute}`
}

export function formatTime12h(timeStr: string | null | undefined) {
  if (!timeStr) return '—'
  const parts = parseTime24(timeStr)
  if (!parts) return timeStr
  return `${parts.hour.padStart(2, '0')}:${parts.minute} ${parts.period}`
}
