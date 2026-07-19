/** Keep in sync with server/routes/transport.js */

export const TRANSPORT_READ_ROLES = [
  'Super Admin',
  'School Admin',
  'Principal',
  'Van Driver',
  'Driver',
  'Parent',
] as const

export const TRANSPORT_ADMIN_ROLES = ['Super Admin', 'School Admin', 'Accountant'] as const

export const TRANSPORT_OPERATOR_ROLES = ['Van Driver', 'Driver'] as const

export function canViewTransport(roleName?: string | null): boolean {
  if (!roleName) return false
  return TRANSPORT_READ_ROLES.some((r) => r.toLowerCase() === roleName.trim().toLowerCase())
}

export function canManageTransport(roleName?: string | null): boolean {
  if (!roleName) return false
  return TRANSPORT_ADMIN_ROLES.some((r) => r.toLowerCase() === roleName.trim().toLowerCase())
}

export function isTransportOperator(roleName?: string | null): boolean {
  if (!roleName) return false
  return TRANSPORT_OPERATOR_ROLES.some((r) => r.toLowerCase() === roleName.trim().toLowerCase())
}
