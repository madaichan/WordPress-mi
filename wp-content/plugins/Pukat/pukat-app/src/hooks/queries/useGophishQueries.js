import { useQuery } from '@tanstack/react-query'
import { gophishApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useGophishStatusQuery(options = {}) {
  return useQuery({
    queryKey: queryKeys.gophish.status,
    queryFn: gophishApi.status,
    ...options,
  })
}

export function useGophishEmailTemplates(options = {}) {
  return useQuery({
    queryKey: queryKeys.gophish.emailTemplates,
    queryFn: gophishApi.emailTemplates,
    ...options,
  })
}

export function useGophishLandingPages(options = {}) {
  return useQuery({
    queryKey: queryKeys.gophish.landingPages,
    queryFn: gophishApi.landingPages,
    ...options,
  })
}

export function useGophishSmtpProfiles(options = {}) {
  return useQuery({
    queryKey: queryKeys.gophish.smtpProfiles,
    queryFn: gophishApi.smtpProfiles,
    ...options,
  })
}

export function useGophishGroups(options = {}) {
  return useQuery({
    queryKey: queryKeys.gophish.groups,
    queryFn: gophishApi.groups,
    ...options,
  })
}
