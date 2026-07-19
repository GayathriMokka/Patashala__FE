export const REVENUE_VIEW_ROLES = [
  'Super Admin',
  'School Admin',
  'Principal',
  'Accountant',
] as const

export type RevenueViewRole = (typeof REVENUE_VIEW_ROLES)[number]

export function canViewRevenue(roleName?: string | null): boolean {
  if (!roleName) return false
  return REVENUE_VIEW_ROLES.includes(roleName as RevenueViewRole)
}
