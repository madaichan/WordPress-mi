import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { flagApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

function useFlagMutation(mutationFn, successMessage, invalidate, options) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      toast.success(successMessage)
      invalidate.forEach(queryKey => qc.invalidateQueries({ queryKey }))
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

// queryKeys.flags.all is a prefix of every examples key, so it refreshes both.
const FLAG_KEYS = [queryKeys.flags.all]
const EXAMPLE_KEYS = [queryKeys.flags.all, queryKeys.entities.overview, queryKeys.entities.readinessAll]

export function useCreateFlagMutation(options = {}) {
  return useFlagMutation(data => flagApi.create(data), 'Flag category created.', FLAG_KEYS, options)
}

export function useUpdateFlagMutation(options = {}) {
  return useFlagMutation(({ id, data }) => flagApi.update(id, data), 'Flag category updated.', FLAG_KEYS, options)
}

export function useDeleteFlagMutation(options = {}) {
  return useFlagMutation(id => flagApi.delete(id), 'Flag category deleted.', FLAG_KEYS, options)
}

// Called as mutate({ formData, onProgress }) — onProgress receives axios
// upload progress events (bytes sent), for the upload progress indicator.
export function useUploadFlagExampleMutation(options = {}) {
  return useFlagMutation(
    ({ formData, onProgress }) => flagApi.uploadExample(formData, onProgress),
    'Example uploaded.',
    EXAMPLE_KEYS,
    options
  )
}

export function useDeleteFlagExampleMutation(options = {}) {
  return useFlagMutation(id => flagApi.deleteExample(id), 'Example deleted.', EXAMPLE_KEYS, options)
}

// Education page (one per entity). Called as mutate({ data }); `data.entity`
// is only honored for admins.
export function useSaveFlagPageMutation(options = {}) {
  return useFlagMutation(({ data }) => flagApi.savePage(data), 'Draft saved.', FLAG_KEYS, options)
}

export function usePublishFlagPageMutation(options = {}) {
  return useFlagMutation(({ data }) => flagApi.publishPage(data), 'Education page published.', FLAG_KEYS, options)
}

export function useUnpublishFlagPageMutation(options = {}) {
  return useFlagMutation(({ data }) => flagApi.unpublishPage(data), 'Education page unpublished.', FLAG_KEYS, options)
}

// Re-push the published page to GoPhish. The request returns 200 even when the
// GoPhish side failed (reported in `data.sync.ok`), so the toast reflects that
// rather than a fixed success message.
export function useSyncFlagPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ data }) => flagApi.syncPage(data),
    onSuccess: (data, variables, context) => {
      if (data?.sync && data.sync.ok === false) {
        toast.error(data.sync.message || 'GoPhish sync failed.')
      } else {
        toast.success(data?.sync?.message || 'Synced to GoPhish.')
      }
      FLAG_KEYS.forEach(queryKey => qc.invalidateQueries({ queryKey }))
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}
