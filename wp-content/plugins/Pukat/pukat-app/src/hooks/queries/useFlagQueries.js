import { useQuery } from '@tanstack/react-query'
import { flagApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useFlags(options = {}) {
  return useQuery({
    queryKey: queryKeys.flags.all,
    queryFn: () => flagApi.list(),
    ...options,
  })
}

/** Returns { examples, max_upload_bytes }. */
export function useFlagExamples(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.flags.examples(params),
    queryFn: () => flagApi.listExamples(params),
    ...options,
  })
}
