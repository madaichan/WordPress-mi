import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { roleApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreateRoleMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data) => roleApi.create(data),
    onSuccess: (data, variables, context) => {
      toast.success('Role created.')
      qc.invalidateQueries({ queryKey: queryKeys.roles.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateRoleMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, data }) => roleApi.update(slug, data),
    onSuccess: (data, variables, context) => {
      toast.success('Role updated.')
      qc.invalidateQueries({ queryKey: queryKeys.roles.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteRoleMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (slug) => roleApi.remove(slug),
    onSuccess: (data, variables, context) => {
      toast.success('Role deleted.')
      qc.invalidateQueries({ queryKey: queryKeys.roles.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}
