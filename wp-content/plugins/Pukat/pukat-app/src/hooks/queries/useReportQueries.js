import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useRiskScores(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reports.riskScores(params),
    queryFn: () => reportApi.riskScores(params),
    ...options,
  })
}
