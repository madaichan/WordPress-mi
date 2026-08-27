import { del, get, post, put } from './client.js'

export const masterAssetApi = {
  emailTemplates: () => get('/master/email-templates'),
  createEmailTemplate: (data) => post('/master/email-templates', data),
  updateEmailTemplate: (id, data) => put(`/master/email-templates/${id}`, data),
  deleteEmailTemplate: (id) => del(`/master/email-templates/${id}`),
  emailTemplateVersions: (id) => get(`/master/email-templates/${id}/versions`),
  createEmailTemplateVersion: (id, data) => post(`/master/email-templates/${id}/versions`, data),
  updateEmailTemplateVersion: (id, data) => put(`/master/email-template-versions/${id}`, data),
  approveEmailTemplateVersion: (id) => post(`/master/email-template-versions/${id}/approve`),

  landingPages: () => get('/master/landing-pages'),
  createLandingPage: (data) => post('/master/landing-pages', data),
  updateLandingPage: (id, data) => put(`/master/landing-pages/${id}`, data),
  deleteLandingPage: (id) => del(`/master/landing-pages/${id}`),
  landingPageVersions: (id) => get(`/master/landing-pages/${id}/versions`),
  createLandingPageVersion: (id, data) => post(`/master/landing-pages/${id}/versions`, data),
  updateLandingPageVersion: (id, data) => put(`/master/landing-page-versions/${id}`, data),
  approveLandingPageVersion: (id) => post(`/master/landing-page-versions/${id}/approve`),

  sendingProfiles: () => get('/master/sending-profiles'),
  createSendingProfile: (data) => post('/master/sending-profiles', data),
  updateSendingProfile: (id, data) => put(`/master/sending-profiles/${id}`, data),
  deleteSendingProfile: (id) => del(`/master/sending-profiles/${id}`),
  validateSendingProfile: (id) => post(`/master/sending-profiles/${id}/validate-gophish`),
  syncSendingProfilesFromGophish: () => post('/master/sending-profiles/sync-gophish'),

  dynamicDomains: () => get('/master/dynamic-domains'),
  createDynamicDomain: (data) => post('/master/dynamic-domains', data),
  updateDynamicDomain: (id, data) => put(`/master/dynamic-domains/${id}`, data),
  deleteDynamicDomain: (id) => del(`/master/dynamic-domains/${id}`),
  healthCheckDynamicDomain: (id) => post(`/master/dynamic-domains/${id}/health-check`),
}

export default masterAssetApi
