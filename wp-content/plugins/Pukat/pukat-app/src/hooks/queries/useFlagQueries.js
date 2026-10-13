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

/** The entity's single education page (empty page if none saved yet). */
export function useFlagPage(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.flags.page(params),
    queryFn: () => flagApi.getPage(params),
    // The editor holds unsaved text; a focus refetch must not race it.
    refetchOnWindowFocus: false,
    ...options,
  })
}
