import { useQuery } from '@tanstack/react-query'
import { profileApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useMyProfile(options = {}) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: profileApi.get,
    ...options,
  })
}
