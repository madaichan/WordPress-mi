import { useQuery } from '@tanstack/react-query'
import { campaignGroupApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCampaignGroups(options = {}) {
  return useQuery({
    queryKey: queryKeys.campaignGroups.all,
    queryFn: () => campaignGroupApi.list(),
    ...options,
  })
}

/**
 * Aggregate funnel stats for one group, or pass groupId = 'active' for the
 * sum across every group whose computed status is Active. Powers
 * Monitoring's stat cards/funnel.
 */
export function useCampaignGroupReport(groupId, options = {}) {
  return useQuery({
    queryKey: queryKeys.campaignGroups.report(groupId),
    queryFn: () => campaignGroupApi.report(groupId),
    enabled: Boolean(groupId),
    ...options,
  })
}
