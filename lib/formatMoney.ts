const INR = '\u20B9'

export function formatMoney(
  value: number | string | null | undefined,
  options?: { decimals?: number; compact?: boolean; symbol?: boolean }
) {
  const num = Number(value || 0)
  const decimals = options?.compact ? 0 : (options?.decimals ?? 2)
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  if (options?.symbol === false) return formatted
  return `${INR}${formatted}`
}
