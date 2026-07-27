import { useQuery } from '@tanstack/react-query'
import { playbookApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function usePlaybooks(options = {}) {
  return useQuery({
    queryKey: queryKeys.playbooks.list,
    queryFn: playbookApi.list,
    ...options,
  })
}
