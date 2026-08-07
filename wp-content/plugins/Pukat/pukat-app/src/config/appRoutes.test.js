import { describe, expect, it } from 'vitest'
import {
  adminRoutes,
  frontendRoutes,
  adminRoutePermissions,
  frontendRoutePermissions,
  adminNavGroups,
  filterNavGroupsByPermission,
} from './appRoutes.jsx'

function pathedRoutes(routes) {
  // The `*` catch-all is deliberately unguarded (see appRoutes.jsx comment) — excluded here.
  return routes.filter((route) => route.path && route.path !== '*')
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

  it('against the real admin nav: a dashboard-only permission set keeps just Overview', () => {
    const result = filterNavGroupsByPermission(adminNavGroups, adminRoutePermissions, ['dashboard.view'])
    expect(result).toHaveLength(1)
    expect(result[0].group).toBe('Overview')
  })
})
