import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { gophishApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useCreateEmailTemplateMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.createEmailTemplate,
    onSuccess: (data, variables, context) => {
      toast.success('Email template created in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.emailTemplates })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to create email template.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateEmailTemplateMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => gophishApi.updateEmailTemplate(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Email template updated in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.emailTemplates })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update email template.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignEmailTemplateEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, entity }) => gophishApi.assignEmailTemplateEntity(id, entity),
    onSuccess: (data, variables, context) => {
      toast.success('Email template assignment saved.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.emailTemplates })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save email template assignment.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteEmailTemplateMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.deleteEmailTemplate,
    onSuccess: (data, variables, context) => {
      toast.success('Email template deleted in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.emailTemplates })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete email template.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateLandingPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.createLandingPage,
    onSuccess: (data, variables, context) => {
      toast.success('Landing page created in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.landingPages })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to create landing page.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateLandingPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => gophishApi.updateLandingPage(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('Landing page updated in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.landingPages })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update landing page.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignLandingPageEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, entity }) => gophishApi.assignLandingPageEntity(id, entity),
    onSuccess: (data, variables, context) => {
      toast.success('Landing page assignment saved.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.landingPages })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save landing page assignment.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useDeleteLandingPageMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.deleteLandingPage,
    onSuccess: (data, variables, context) => {
      toast.success('Landing page deleted in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.landingPages })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete landing page.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useCreateSmtpProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.createSmtpProfile,
    onSuccess: (data, variables, context) => {
      toast.success('SMTP profile created in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.smtpProfiles })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to create SMTP profile.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useUpdateSmtpProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }) => gophishApi.updateSmtpProfile(id, data),
    onSuccess: (data, variables, context) => {
      toast.success('SMTP profile updated in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.smtpProfiles })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to update SMTP profile.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useAssignSmtpProfileEntityMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, entity }) => gophishApi.assignSmtpProfileEntity(id, entity),
    onSuccess: (data, variables, context) => {
      toast.success('SMTP profile assignment saved.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.smtpProfiles })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to save SMTP profile assignment.')
      options.onError?.(err, variables, context)
    },
  })
}

export function useSendTestSmtpEmailMutation(options = {}) {
  return useMutation({
    mutationFn: gophishApi.sendTestSmtpEmail,
    onSuccess: options.onSuccess,
    onError: options.onError,
  })
}

export function useDeleteSmtpProfileMutation(options = {}) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: gophishApi.deleteSmtpProfile,
    onSuccess: (data, variables, context) => {
      toast.success('SMTP profile deleted in GoPhish.')
      qc.invalidateQueries({ queryKey: queryKeys.gophish.smtpProfiles })
      options.onSuccess?.(data, variables, context)
    },
    onError: (err, variables, context) => {
      toast.error(err.message || 'Failed to delete SMTP profile.')
      options.onError?.(err, variables, context)
    },
  })
}
