import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useSettingsQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.get,
    ...options,
  })
}
