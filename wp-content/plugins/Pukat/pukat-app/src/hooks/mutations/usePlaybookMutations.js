import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { playbookApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

function invalidatePlaybooks(qc) {
  qc.invalidateQueries({ queryKey: queryKeys.playbooks.all })
  qc.invalidateQueries({ queryKey: queryKeys.tables.all })
}

export function useCreatePlaybookMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: playbookApi.create,
    onSuccess: (data, variables, context) => {
      toast.success('Playbook saved.')
      invalidatePlaybooks(qc)
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
      invalidatePlaybooks(qc)
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
      invalidatePlaybooks(qc)
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
      invalidatePlaybooks(qc)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete playbook.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useSubmitPlaybookReviewMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: playbookApi.submitReview,
    onSuccess: (data, variables, context) => {
      toast.success('Playbook submitted for review.')
      invalidatePlaybooks(qc)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to submit playbook for review.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useApprovePlaybookMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: playbookApi.approve,
    onSuccess: (data, variables, context) => {
      toast.success('Playbook approved.')
      invalidatePlaybooks(qc)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      // playbook_not_ready's granular `errors` array is dropped by
      // RestController::from_wp_error() (only message/code/status survive) —
      // surfacing err.message is the best available UX without a backend change.
      toast.error(err.message || 'Failed to approve playbook.')
      options.onError?.(err, variables, context)
    },
  })
}
