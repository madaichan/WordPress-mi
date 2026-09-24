import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { profileApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useUpdateProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: profileApi.update,
    onSuccess: (data, variables, context) => {
      toast.success('Profile updated successfully.')
      qc.invalidateQueries({ queryKey: queryKeys.me })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

/**
 * A successful change ends every session for this user server-side
 * (wp_set_password() — see ProfileController::change_password()), so the
 * caller must send the browser to logoutUrl right after, not keep going as
 * if the current session were still valid.
 */
export function useChangePasswordMutation(options = {}) {
  return useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: (data, variables, context) => {
      toast.success('Password changed. Redirecting to login...')
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}
