import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { userApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useUpdateUserRoleMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }) => userApi.updateRole(id, role),
    onSuccess: (data, variables, context) => {
      toast.success('Role updated.')
      qc.invalidateQueries({ queryKey: queryKeys.users.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}
