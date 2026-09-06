import { get, post, put, del } from './client.js'

/** id: a real group id, or 'active' for the aggregate across every Active group. */
function reportPath(id) {
  return 'active' === id ? '/campaign-groups/active/report' : `/campaign-groups/${id}/report`
}

function reportExportPath(id) {
  return 'active' === id ? '/campaign-groups/active/report/export' : `/campaign-groups/${id}/report/export`
}

export const campaignGroupApi = {
  list:   ()          => get('/campaign-groups'),
  get:    (id)         => get(`/campaign-groups/${id}`),
  create: (data)       => post('/campaign-groups', data),
  update: (id, data)   => put(`/campaign-groups/${id}`, data),
  delete: (id)         => del(`/campaign-groups/${id}`),
  report: (id)         => get(reportPath(id)),
  reportExportPdf: (id) => get(reportExportPath(id), { responseType: 'blob' }),
}

export default campaignGroupApi
