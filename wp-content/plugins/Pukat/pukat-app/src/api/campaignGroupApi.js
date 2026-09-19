import { get, post, put, del } from './client.js'

/** id: a real group id, or 'active' for the aggregate across every Active group. */
function reportPath(id) {
  return 'active' === id ? '/campaign-groups/active/report' : `/campaign-groups/${id}/report`
}

function reportExportPath(id) {
  return 'active' === id ? '/campaign-groups/active/report/export' : `/campaign-groups/${id}/report/export`
}

// "Download data" (CSV/XLSX of the Campaign funnel summary) — docs/PRD_MONITORING_DATA_EXPORT.md.
function reportExportDataPath(id) {
  return 'active' === id ? '/campaign-groups/active/report/export-data' : `/campaign-groups/${id}/report/export-data`
}

export const campaignGroupApi = {
  list:   ()          => get('/campaign-groups'),
  get:    (id)         => get(`/campaign-groups/${id}`),
  create: (data)       => post('/campaign-groups', data),
  update: (id, data)   => put(`/campaign-groups/${id}`, data),
  delete: (id)         => del(`/campaign-groups/${id}`),
  report: (id)         => get(reportPath(id)),
  reportExportPdf: (id) => get(reportExportPath(id), { responseType: 'blob' }),
  reportExportData: (id, format) => get(reportExportDataPath(id), { params: { format }, responseType: 'blob' }),
}

export default campaignGroupApi
