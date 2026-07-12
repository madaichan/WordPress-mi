import { useQuery } from '@tanstack/react-query'
import { campaignApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCampaignList(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.campaigns.list(params),
    queryFn: () => campaignApi.list(params),
    ...options,
  })
}

export function useCampaignItems(params = {}, options = {}) {
  return useCampaignList(params, {
    select: data => data?.items ?? [],
    ...options,
  })
}
