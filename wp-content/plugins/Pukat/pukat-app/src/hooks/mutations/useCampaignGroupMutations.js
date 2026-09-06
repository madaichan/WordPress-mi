import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { campaignGroupApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreateCampaignGroupMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data) => campaignGroupApi.create(data),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign group created.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateCampaignGroupMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => campaignGroupApi.update(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign group updated.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteCampaignGroupMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id) => campaignGroupApi.delete(id),
    onSuccess: (data, variables, context) => {
      toast.success('Campaign group deleted.')
      qc.invalidateQueries({ queryKey: queryKeys.campaignGroups.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}
