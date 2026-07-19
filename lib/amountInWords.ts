const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n] || ''
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return `${TENS[tens]}${ones ? ` ${ONES[ones]}` : ''}`.trim()
}

function threeDigitWords(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const hundredPart = hundreds ? `${ONES[hundreds]} Hundred` : ''
  const restPart = rest ? twoDigitWords(rest) : ''
  if (hundredPart && restPart) return `${hundredPart} ${restPart}`
  return hundredPart || restPart
}

/** Convert a positive integer (up to 99 crores) into Indian English words. */
function integerToIndianWords(n: number): string {
  if (n === 0) return 'Zero'

  const parts: string[] = []
  let remaining = n

  const crore = Math.floor(remaining / 10000000)
  remaining %= 10000000
  if (crore) parts.push(`${integerToIndianWords(crore)} Crore`)

  const lakh = Math.floor(remaining / 100000)
  remaining %= 100000
  if (lakh) parts.push(`${threeDigitWords(lakh)} Lakh`.replace('  ', ' '))

  const thousand = Math.floor(remaining / 1000)
  remaining %= 1000
  if (thousand) parts.push(`${threeDigitWords(thousand)} Thousand`.replace('  ', ' '))

  if (remaining) parts.push(threeDigitWords(remaining))

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Format a currency amount as Indian receipt words, e.g. "Five Thousand Rupees Only".
 */
export function formatAmountInWords(amount: number | string | null | undefined): string {
  const value = parseFloat(String(amount ?? ''))
  if (Number.isNaN(value)) return ''

  const sign = value < 0 ? 'Minus ' : ''
  const absolute = Math.abs(value)
  const rupees = Math.floor(absolute)
  const paise = Math.round((absolute - rupees) * 100)

  let words = sign + integerToIndianWords(rupees)
  words += rupees === 1 ? ' Rupee' : ' Rupees'

  if (paise > 0) {
    words += ` and ${integerToIndianWords(paise)} Paise`
  }

  return `${words} Only`
}
