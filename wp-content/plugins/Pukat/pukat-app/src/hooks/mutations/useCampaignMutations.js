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
