import { useQuery } from '@tanstack/react-query'
import { masterAssetApi } from '../../api/index.js'
import { queryKeys } from '../../api/queryKeys.js'

export function useMasterEmailTemplates(options = {}) {
  return useQuery({
    queryKey: queryKeys.masterAssets.emailTemplates,
    queryFn: masterAssetApi.emailTemplates,
    ...options,
  })
}

export function useMasterLandingPages(options = {}) {
  return useQuery({
    queryKey: queryKeys.masterAssets.landingPages,
    queryFn: masterAssetApi.landingPages,
    ...options,
  })
}

export function useMasterSendingProfiles(options = {}) {
  return useQuery({
    queryKey: queryKeys.masterAssets.sendingProfiles,
    queryFn: masterAssetApi.sendingProfiles,
    ...options,
  })
}

export function useMasterDynamicDomains(options = {}) {
  return useQuery({
    queryKey: queryKeys.masterAssets.dynamicDomains,
    queryFn: masterAssetApi.dynamicDomains,
    ...options,
  })
}
