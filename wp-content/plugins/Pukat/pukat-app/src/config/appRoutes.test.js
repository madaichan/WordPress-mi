import { describe, expect, it } from 'vitest'
import {
  adminRoutes,
  frontendRoutes,
  adminRoutePermissions,
  frontendRoutePermissions,
  adminNavGroups,
  frontendNavGroups,
  filterNavGroupsByPermission,
} from './appRoutes.jsx'

// Routes that intentionally have no `permission` key because they only ever
// read/write the logged-in user's own data, not a feature gated by role (see
// the matching comment on each route in appRoutes.jsx). My Profile exists
// under two different paths because it's registered in both the wp-admin-
// embedded app (adminRoutes) and the standalone /pukat/ app (frontendRoutes)
// — the two are separate route trees, so both need their own entry.
const UNGUARDED_SELF_SERVICE_ROUTES = ['/admin/my-profile', '/my-profile']

function pathedRoutes(routes) {
  // The `*` catch-all is deliberately unguarded (see appRoutes.jsx comment) — excluded here.
  return routes.filter((route) => route.path && route.path !== '*' && !UNGUARDED_SELF_SERVICE_ROUTES.includes(route.path))
}

describe('appRoutes permission declarations', () => {
  it('every admin route declares a non-empty permission key', () => {
    pathedRoutes(adminRoutes).forEach((route) => {
      expect(route.permission, `route ${route.path} has no permission`).toBeTruthy()
    })
  })

  it('every frontend route declares a non-empty permission key', () => {
    pathedRoutes(frontendRoutes).forEach((route) => {
      expect(route.permission, `route ${route.path} has no permission`).toBeTruthy()
    })
  })

  it('adminRoutePermissions/frontendRoutePermissions mirror the route arrays 1:1', () => {
    pathedRoutes(adminRoutes).forEach((route) => {
      expect(adminRoutePermissions.get(route.path)).toBe(route.permission)
    })
    pathedRoutes(frontendRoutes).forEach((route) => {
      expect(frontendRoutePermissions.get(route.path)).toBe(route.permission)
    })
  })
})

describe('filterNavGroupsByPermission', () => {
  const groups = [
    { group: 'G1', items: [{ to: '/a', label: 'A' }, { to: '/b', label: 'B' }] },
    { group: 'G2', items: [{ to: '/c', label: 'C' }] },
    { group: 'G3', items: [{ to: '/unguarded', label: 'Unguarded' }] },
  ]
  const map = new Map([['/a', 'perm.a'], ['/b', 'perm.b'], ['/c', 'perm.c']])

  it('keeps only items whose required permission is held', () => {
    const result = filterNavGroupsByPermission(groups, map, ['perm.a'])
    expect(result).toEqual([
      { group: 'G1', items: [{ to: '/a', label: 'A' }] },
      { group: 'G3', items: [{ to: '/unguarded', label: 'Unguarded' }] },
    ])
  })

  it('drops a group entirely once every item in it is filtered out', () => {
    const result = filterNavGroupsByPermission(groups, map, [])
    expect(result.find((g) => g.group === 'G2')).toBeUndefined()
  })

  it('always shows items with no mapped permission, regardless of held permissions', () => {
    const result = filterNavGroupsByPermission(groups, map, [])
    expect(result.find((g) => g.group === 'G3')).toBeTruthy()
  })

  it('shows every item when every required permission is held', () => {
    const result = filterNavGroupsByPermission(groups, map, ['perm.a', 'perm.b', 'perm.c'])
    expect(result).toEqual(groups)
  })

  it('against the real admin nav: a dashboard-only permission set keeps Overview plus unguarded self-service items', () => {
    const result = filterNavGroupsByPermission(adminNavGroups, adminRoutePermissions, ['dashboard.view'])
    expect(result).toHaveLength(2)
    expect(result[0].group).toBe('Overview')
    // 'Admin' survives with only its unguarded item (My Profile) — every
    // other item in that group requires a permission this set doesn't hold.
    expect(result[1].group).toBe('Admin')
    expect(result[1].items).toEqual([{ to: '/admin/my-profile', icon: 'ti-user-circle', label: 'My Profile' }])
  })

  // Regression test: an operator whose permission set holds none of the
  // gated frontend nav items (e.g. no dashboard.view, no calendar.view —
  // this actually happened with a seeded pukatopr test account) must still
  // see My Profile in the standalone /pukat/ app's sidebar, not just in the
  // wp-admin-embedded one.
  it('against the real frontend nav: an empty permission set still keeps the unguarded My Profile item', () => {
    const result = filterNavGroupsByPermission(frontendNavGroups, frontendRoutePermissions, [])
    const accountGroup = result.find((g) => g.group === 'Account')
    expect(accountGroup).toBeTruthy()
    expect(accountGroup.items).toEqual([{ to: '/my-profile', icon: 'ti-user-circle', label: 'My Profile' }])
  })
})
