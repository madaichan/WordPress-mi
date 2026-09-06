import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { campaignApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreateCampaignMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: campaignApi.create,
    onSuccess: (data, variables, context) => {
      toast.success('Campaign saved successfully.')
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed meluncurkan campaign.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateCampaignRunMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: campaignApi.createRun,
    onSuccess: (data, variables, context) => {
      toast.success('Campaign run saved successfully.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to create campaign run.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useLaunchCampaignRunMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: id => campaignApi.launchRun(id),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign run launched in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.gophish.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to launch campaign run.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useImportCampaignRunTargetsMutation(options = {}) {
  return useMutation({
    mutationFn: ({ campaignRunId, targets }) => campaignApi.importRunTargets(campaignRunId, targets),
    onSuccess: options.onSuccess,
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to import targets.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useLaunchCampaignMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => campaignApi.launch(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign launched in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      qc.invalidateQueries({ queryKey: queryKeys.gophish.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to launch campaign.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteCampaignMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: id => campaignApi.delete(id),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign deleted successfully.')
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

// Single "Complete" lifecycle action for Campaign Run (cancel/recall/complete
// merged into one, docs/PRD_CAMPAIGN_GROUP_MONITORING.md §6.4).
export function useCompleteCampaignRunMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: id => campaignApi.runComplete(id),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign completed.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to complete campaign.')
      options.onError?.(err, variables, context)
    },
  })
}

// ids: number[]. Resolves with per-item results even when some ids fail —
// never rejects just because one item in the batch couldn't be completed
// (docs/PRD_CAMPAIGN_GROUP_MONITORING.md §7.4 FR-10) — callers should inspect
// the resolved array's `success`/`error` per row rather than relying on
// onError for partial failures.
export function useBulkCompleteCampaignRunMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ids => campaignApi.runBulkComplete(ids),
    onSuccess: (data, variables, context) => {
      const failed = (data || []).filter(row => !row.success)
      if (failed.length > 0) {
        toast.error(`${failed.length} of ${data.length} campaign(s) could not be completed.`)
      } else {
        toast.success(`${data.length} campaign(s) completed.`)
      }
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to complete campaigns.')
      options.onError?.(err, variables, context)
    },
  })
}

// Manual on-demand refresh of GoPhish results — the same pull the 5-minute
// cron does automatically, exposed here so a PIC doesn't have to wait for it.
export function useSyncCampaignRunResultsMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: id => campaignApi.runSyncResults(id),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign results refreshed from GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.report(variables) })
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to refresh campaign results.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignCampaignRunGroupMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, groupId }) => campaignApi.runAssignGroup(id, groupId),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign moved.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to move campaign.')
      options.onError?.(err, variables, context)
    },
  })
}

// ids: number[]. Same per-item partial-failure shape as bulk-complete — one
// Campaign Run failing entity validation doesn't block the rest of the batch.
export function useBulkAssignCampaignRunGroupMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ ids, groupId }) => campaignApi.runBulkAssignGroup(ids, groupId),
    onSuccess: (data, variables, context) => {
      const failed = (data || []).filter(row => !row.success)
      if (failed.length > 0) {
        toast.error(`${failed.length} of ${data.length} campaign(s) could not be moved.`)
      } else {
        toast.success(`${data.length} campaign(s) moved.`)
      }
      qc.invalidateQueries({ queryKey: queryKeys.campaignRuns.all })
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to move campaigns.')
      options.onError?.(err, variables, context)
    },
  })
}
