import { get, post, put, patch, del } from './client.js'

function emailDomainsPath(entityName) {
  return `/entities/by-name/${encodeURIComponent(entityName)}/email-domains`
}

function reportContactPath(entityName) {
  return `/entities/by-name/${encodeURIComponent(entityName)}/report-contact`
}

export const entityApi = {
  list:   ()        => get('/entities'),
  get:    (id)       => get(`/entities/${id}`),
  create: (data)     => post('/entities', data),
  update: (id, data) => put(`/entities/${id}`, data),
  delete: (id)       => del(`/entities/${id}`),

  // Admin oversight summary — docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14.2.
  guardrailsOverview: () => get('/entities/guardrails-overview'),

  listEmailDomains:      (entityName)             => get(emailDomainsPath(entityName)),
  addEmailDomain:        (entityName, domain)     => post(emailDomainsPath(entityName), { domain }),
  removeEmailDomain:     (entityName, id)         => del(`${emailDomainsPath(entityName)}/${id}`),
  setEmailDomainStatus:  (entityName, id, status) => patch(`${emailDomainsPath(entityName)}/${id}`, { status }),

  getReportContact:  (entityName)       => get(reportContactPath(entityName)),
  saveReportContact: (entityName, data) => put(reportContactPath(entityName), data),
}

export default entityApi
