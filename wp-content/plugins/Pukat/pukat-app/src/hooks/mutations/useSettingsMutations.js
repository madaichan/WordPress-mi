import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { gophishApi, settingsApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useSaveSettingsMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data, variables, context) => {
      toast.success('Settings saved successfully.')
      qc.invalidateQueries({ queryKey: queryKeys.settings })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useTestGophishConnectionMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.status,
    onSuccess: (data, variables, context) => {
      toast.success('Successfully connected to GoPhish!')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.status })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(`Connection failed: ${err.message}`)
      options.onError?.(err, variables, context)
    },
  })
}
