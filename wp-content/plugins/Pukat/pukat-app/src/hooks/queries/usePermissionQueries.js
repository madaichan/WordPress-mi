import { useQuery } from '@tanstack/react-query'
import { permissionApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

/**
 * The current user's granted permission keys. Fetched once at app bootstrap
 * (see App.jsx) and kept for the whole session — a role/permission change
 * made by an admin elsewhere won't be picked up until the next page load,
 * which matches how the rest of this app already treats the injected user
 * object (also bootstrap-once, see useAppStore.js).
 */
export function useMyPermissions(options = {}) {
  return useQuery({
    queryKey: queryKeys.permissions.mine,
    queryFn: () => permissionApi.mine(),
    staleTime: Infinity,
    ...options,
  })
}
