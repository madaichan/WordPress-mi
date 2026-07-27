import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { playbookApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreatePlaybookMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: playbookApi.create,
    onSuccess: (data, variables, context) => {
      toast.success('Playbook saved.')
      qc.invalidateQueries({ queryKey: queryKeys.playbooks.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save playbook.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdatePlaybookMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => playbookApi.update(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Playbook updated.')
      qc.invalidateQueries({ queryKey: queryKeys.playbooks.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update playbook.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDuplicatePlaybookMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => playbookApi.duplicate(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Playbook cloned.')
      qc.invalidateQueries({ queryKey: queryKeys.playbooks.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to clone playbook.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeletePlaybookMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: playbookApi.delete,
    onSuccess: (data, variables, context) => {
      toast.success('Playbook deleted.')
      qc.invalidateQueries({ queryKey: queryKeys.playbooks.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete playbook.')
      options.onError?.(err, variables, context)
    },
  })
}
