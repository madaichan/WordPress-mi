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
 * Single Campaign Run, used to prefill the wizard when resuming an existing
 * `draft_run` via the "Edit" row action on Manage Campaigns.
 */
export function useCampaignRun(id, options = {}) {
  return useQuery({
    queryKey: queryKeys.campaignRuns.detail(id),
    queryFn: () => campaignApi.runGet(id),
    enabled: Boolean(id),
    ...options,
  })
}

/**
 * Report for a single Campaign Run — reshaped from CampaignRunService::report()'s
 * native { campaign_run, gophish_stats, metrics, ... } into the same
 * { stats, campaign_runs, department_breakdown, hourly_activity, recent_events,
 * generated_at } shape CampaignGroupService's group reports use, so Monitoring
 * can render either without a branch per shape.
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
        playbook_name: result?.campaign_run?.source_playbook?.name ?? null,
        launched_at: result?.campaign_run?.launched_at ?? null,
        schedule_at: result?.campaign_run?.schedule_at ?? null,
        synced_at: result?.metrics?.synced_at ?? null,
      } ],
      synced_at: result?.metrics?.synced_at ?? null,
      department_breakdown: result?.metrics?.department_breakdown ?? [],
      hourly_activity: result?.metrics?.hourly_activity ?? [],
      recent_events: result?.metrics?.recent_events ?? [],
      target_details: result?.metrics?.target_details ?? [],
      generated_at: result?.generated_at,
    }),
    enabled: Boolean(id),
    ...options,
  })
}
