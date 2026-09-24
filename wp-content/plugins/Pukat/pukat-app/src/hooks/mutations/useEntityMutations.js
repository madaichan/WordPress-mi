import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { entityApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreateEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data) => entityApi.create(data),
    onSuccess: (data, variables, context) => {
      toast.success('Entity Profile created.')
      qc.invalidateQueries({ queryKey: queryKeys.entities.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => entityApi.update(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Entity Profile updated.')
      // entities.all is a prefix of entities.overview, so this refreshes both.
      qc.invalidateQueries({ queryKey: queryKeys.entities.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id) => entityApi.delete(id),
    onSuccess: (data, variables, context) => {
      toast.success('Entity Profile deleted.')
      qc.invalidateQueries({ queryKey: queryKeys.entities.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

function invalidateEmailDomains(qc, entityName) {
  qc.invalidateQueries({ queryKey: queryKeys.entities.emailDomains(entityName) })
  qc.invalidateQueries({ queryKey: queryKeys.entities.overview })
}

export function useAddEntityEmailDomainMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ entityName, domain }) => entityApi.addEmailDomain(entityName, domain),
    onSuccess: (data, variables, context) => {
      toast.success('Domain added.')
      invalidateEmailDomains(qc, variables.entityName)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useRemoveEntityEmailDomainMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ entityName, id }) => entityApi.removeEmailDomain(entityName, id),
    onSuccess: (data, variables, context) => {
      toast.success('Domain removed.')
      invalidateEmailDomains(qc, variables.entityName)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

export function useSaveEntityReportContactMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ entityName, data }) => entityApi.saveReportContact(entityName, data),
    onSuccess: (data, variables, context) => {
      toast.success('Report contact saved.')
      qc.invalidateQueries({ queryKey: queryKeys.entities.reportContact(variables.entityName) })
      qc.invalidateQueries({ queryKey: queryKeys.entities.overview })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}

// Enable/disable without deleting — the admin oversight lever (PRD §14.2),
// also available to the entity's own users on their own domains.
export function useSetEntityEmailDomainStatusMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ entityName, id, status }) => entityApi.setEmailDomainStatus(entityName, id, status),
    onSuccess: (data, variables, context) => {
      toast.success(variables.status === 'active' ? 'Domain enabled.' : 'Domain disabled.')
      invalidateEmailDomains(qc, variables.entityName)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message)
      options.onError?.(err, variables, context)
    },
  })
}
