import { useQuery } from '@tanstack/react-query'
import { entityApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useEntities(options = {}) {
  return useQuery({
    queryKey: queryKeys.entities.all,
    queryFn: () => entityApi.list(),
    ...options,
  })
}

export function useGuardrailsOverview(options = {}) {
  return useQuery({
    queryKey: queryKeys.entities.overview,
    queryFn: () => entityApi.guardrailsOverview(),
    ...options,
  })
}

export function useEntityEmailDomains(entityName, options = {}) {
  return useQuery({
    queryKey: queryKeys.entities.emailDomains(entityName),
    queryFn: () => entityApi.listEmailDomains(entityName),
    enabled: Boolean(entityName),
    ...options,
  })
}
