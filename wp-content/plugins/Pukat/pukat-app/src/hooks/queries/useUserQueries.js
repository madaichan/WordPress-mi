import { useQuery } from '@tanstack/react-query'
import { userApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useUsers(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => userApi.list(params),
    ...options,
  })
}

export function useAuditLogs(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.users.auditLogs(params),
    queryFn: () => userApi.auditLogs(params),
    ...options,
  })
}
