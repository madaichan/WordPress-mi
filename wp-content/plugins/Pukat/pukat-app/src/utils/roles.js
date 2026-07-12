export const ROLE_VALUES = ['none', 'pukat_viewer', 'pukat_operator', 'pukat_admin']

export const ROLE_LABELS = {
  none: 'No Access',
  pukat_viewer: 'Viewer',
  pukat_operator: 'Operator',
  pukat_admin: 'Admin',
}

export const ROLE_BADGE = {
  none: 'badge-gray',
  pukat_viewer: 'badge-info',
  pukat_operator: 'badge-warning',
  pukat_admin: 'badge-violet',
}

const ROLE_ALIASES = {
  none: 'none',
  viewer: 'pukat_viewer',
  operator: 'pukat_operator',
  admin: 'pukat_admin',
  pukat_viewer: 'pukat_viewer',
  pukat_operator: 'pukat_operator',
  pukat_admin: 'pukat_admin',
}

export function normalizePukatRole(role) {
  return ROLE_ALIASES[String(role ?? '').trim()] ?? 'none'
}

export function getPukatRoleLabel(role) {
  return ROLE_LABELS[normalizePukatRole(role)]
}

export function getPukatRoleBadge(role) {
  return ROLE_BADGE[normalizePukatRole(role)]
}

export function canManagePukat(role) {
  return normalizePukatRole(role) === 'pukat_admin'
}

export function canOperatePukat(role) {
  return ['pukat_admin', 'pukat_operator'].includes(normalizePukatRole(role))
}
