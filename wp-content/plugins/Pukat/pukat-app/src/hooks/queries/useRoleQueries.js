import { useQuery } from '@tanstack/react-query'
import { roleApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useRoles(options = {}) {
  return useQuery({
    queryKey: queryKeys.roles.all,
    queryFn: () => roleApi.list(),
    ...options,
  })
}

/**
 * Full Permission Registry, grouped by sidebar group — the shape the Roles
 * page's permission matrix renders. Rarely changes within a session
 * (only when new features ship), so a long staleTime is safe.
 */
export function usePermissionRegistry(options = {}) {
  return useQuery({
    queryKey: queryKeys.permissions.registry,
    queryFn: () => roleApi.permissionRegistry(),
    staleTime: Infinity,
    ...options,
  })
}
