import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { masterAssetApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

function invalidateMasterAssets(qc, queryKey) {
  qc.invalidateQueries({ queryKey })
  qc.invalidateQueries({ queryKey: queryKeys.masterAssets.all })
}

export function useCreateMasterEmailTemplateMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ master, version }) => {
      const template = await masterAssetApi.createEmailTemplate({
        ...master,
        ...version,
        status: 'draft',
      })

      return { template, version: template.latest_version }
    },
    onSuccess: (data, variables, context) => {
      toast.success('Email template draft saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.emailTemplates)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save email template master.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateMasterEmailTemplateMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, master, version }) => {
      const template = await masterAssetApi.updateEmailTemplate(id, master)
      const nextVersion = await masterAssetApi.createEmailTemplateVersion(id, {
        ...version,
        status: 'draft',
      })

      return { template, version: nextVersion }
    },
    onSuccess: (data, variables, context) => {
      toast.success('Email template draft version saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.emailTemplates)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update email template master.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useApproveMasterEmailTemplateVersionMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (versionId) => masterAssetApi.approveEmailTemplateVersion(versionId),
    onSuccess: (data, variables, context) => {
      toast.success('Email template version approved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.emailTemplates)
      qc.invalidateQueries({ queryKey: queryKeys.tables.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to approve email template version.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignMasterEmailTemplateEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, entity }) => masterAssetApi.updateEmailTemplate(id, { entity }),
    onSuccess: (data, variables, context) => {
      toast.success('Email template assignment saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.emailTemplates)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save email template assignment.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteMasterEmailTemplateMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.deleteEmailTemplate,
    onSuccess: (data, variables, context) => {
      toast.success('Email template deleted.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.emailTemplates)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete email template.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateMasterLandingPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ master, version }) => {
      const page = await masterAssetApi.createLandingPage({
        ...master,
        ...version,
        status: 'draft',
      })

      return { page, version: page.latest_version }
    },
    onSuccess: (data, variables, context) => {
      toast.success('Landing page draft saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.landingPages)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save landing page master.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateMasterLandingPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, master, version }) => {
      const page = await masterAssetApi.updateLandingPage(id, master)
      const nextVersion = await masterAssetApi.createLandingPageVersion(id, {
        ...version,
        status: 'draft',
      })

      return { page, version: nextVersion }
    },
    onSuccess: (data, variables, context) => {
      toast.success('Landing page draft version saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.landingPages)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update landing page master.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useApproveMasterLandingPageVersionMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (versionId) => masterAssetApi.approveLandingPageVersion(versionId),
    onSuccess: (data, variables, context) => {
      toast.success('Landing page version approved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.landingPages)
      qc.invalidateQueries({ queryKey: queryKeys.tables.all })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to approve landing page version.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignMasterLandingPageEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, entity }) => masterAssetApi.updateLandingPage(id, { entity }),
    onSuccess: (data, variables, context) => {
      toast.success('Landing page assignment saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.landingPages)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save landing page assignment.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteMasterLandingPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.deleteLandingPage,
    onSuccess: (data, variables, context) => {
      toast.success('Landing page deleted.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.landingPages)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete landing page.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateMasterSendingProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.createSendingProfile,
    onSuccess: (data, variables, context) => {
      toast.success('Sending profile reference saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.sendingProfiles)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save sending profile reference.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateMasterSendingProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => masterAssetApi.updateSendingProfile(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Sending profile reference updated.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.sendingProfiles)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update sending profile reference.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignMasterSendingProfileEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, entity }) => masterAssetApi.updateSendingProfile(id, { entity }),
    onSuccess: (data, variables, context) => {
      toast.success('Sending profile assignment saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.sendingProfiles)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save sending profile assignment.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteMasterSendingProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.deleteSendingProfile,
    onSuccess: (data, variables, context) => {
      toast.success('Sending profile reference deleted.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.sendingProfiles)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete sending profile reference.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useValidateMasterSendingProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.validateSendingProfile,
    onSuccess: (data, variables, context) => {
      toast.success('GoPhish sending profile mapping is valid.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.sendingProfiles)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to validate GoPhish sending profile mapping.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateMasterDynamicDomainMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.createDynamicDomain,
    onSuccess: (data, variables, context) => {
      toast.success('Dynamic domain saved.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.dynamicDomains)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save dynamic domain.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateMasterDynamicDomainMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => masterAssetApi.updateDynamicDomain(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Dynamic domain updated.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.dynamicDomains)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update dynamic domain.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteMasterDynamicDomainMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.deleteDynamicDomain,
    onSuccess: (data, variables, context) => {
      toast.success('Dynamic domain deleted.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.dynamicDomains)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete dynamic domain.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useHealthCheckMasterDynamicDomainMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: masterAssetApi.healthCheckDynamicDomain,
    onSuccess: (data, variables, context) => {
      toast.success('Dynamic domain health check updated.')
      invalidateMasterAssets(qc, queryKeys.masterAssets.dynamicDomains)
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to check dynamic domain health.')
      options.onError?.(err, variables, context)
    },
  })
}
