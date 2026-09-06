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

/**
 * Report for a single Campaign Run — reshaped from CampaignRunService::report()'s
 * native { campaign_run, gophish_stats, ... } into the same
 * { stats, campaign_runs, generated_at } shape CampaignGroupService's group
 * reports use, so Monitoring can render either without a branch per shape.
 */
export function useCampaignRunReport(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.campaignRuns.report(id),
    queryFn: () => campaignApi.runReport(id),
    select: result => ({
      name: result?.campaign_run?.name ?? '',
      stats: result?.gophish_stats ?? {},
      campaign_runs: [ {
        campaign_run_id: id,
        name: result?.campaign_run?.name ?? '',
        status: result?.campaign_run?.status ?? '',
        stats: result?.gophish_stats ?? {},
      } ],
      generated_at: result?.generated_at,
    }),
    enabled: Boolean(id),
    ...options,
  })
}
