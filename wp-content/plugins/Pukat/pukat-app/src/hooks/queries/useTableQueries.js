import { useQuery } from '@tanstack/react-query'
import { tableApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useTableSchema(tableKey, options = {}) {
  return useQuery({
    queryKey: queryKeys.tables.schema(tableKey),
    queryFn: () => tableApi.schema(tableKey),
    staleTime: Infinity,
    ...options,
  })
}

export function useTableRows(tableKey, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.tables.rows(tableKey, params),
    queryFn: () => tableApi.rows(tableKey, params),
    placeholderData: previous => previous,
    ...options,
  })
}
