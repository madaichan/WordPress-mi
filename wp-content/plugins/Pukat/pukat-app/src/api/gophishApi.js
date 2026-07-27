import { del, get, post, put } from './client.js'

export const gophishApi = {
  status:         () => get('/gophish/status'),
  emailTemplates: () => get('/gophish/templates/email'),
  createEmailTemplate: (data) => post('/gophish/templates/email', data),
  updateEmailTemplate: (id, data) => put(`/gophish/templates/email/${id}`, data),
  assignEmailTemplateEntity: (id, entity) => put(`/gophish/templates/email/${id}/entity`, { entity }),
  deleteEmailTemplate: (id) => del(`/gophish/templates/email/${id}`),
  landingPages:   () => get('/gophish/templates/landing'),
  createLandingPage: (data) => post('/gophish/templates/landing', data),
  updateLandingPage: (id, data) => put(`/gophish/templates/landing/${id}`, data),
  assignLandingPageEntity: (id, entity) => put(`/gophish/templates/landing/${id}/entity`, { entity }),
  deleteLandingPage: (id) => del(`/gophish/templates/landing/${id}`),
  smtpProfiles:   () => get('/gophish/smtp'),
  createSmtpProfile: (data) => post('/gophish/smtp', data),
  updateSmtpProfile: (id, data) => put(`/gophish/smtp/${id}`, data),
  assignSmtpProfileEntity: (id, entity) => put(`/gophish/smtp/${id}/entity`, { entity }),
  deleteSmtpProfile: (id) => del(`/gophish/smtp/${id}`),
  groups:         () => get('/gophish/groups'),
}

export default gophishApi
