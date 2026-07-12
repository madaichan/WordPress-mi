import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { campaignApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreateCampaignMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: campaignApi.create,
    onSuccess: (data, variables, context) => {
      toast.success('Campaign launched successfully!')
      qc.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed meluncurkan campaign.')
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
