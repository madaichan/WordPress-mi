import { get, post, put, del } from './client.js'

export const campaignApi = {
  list:     (params)   => get('/campaigns', { params }),
  get:      (id)       => get(`/campaigns/${id}`),
  create:   (data)     => post('/campaigns', data),
  delete:   (id)       => del(`/campaigns/${id}`),
  launch:   (id, data) => post(`/campaigns/${id}/launch`, data),
  complete: (id)       => post(`/campaigns/${id}/complete`),
  results:  (id)       => get(`/campaigns/${id}/results`),

  runList:        ()   => get('/campaign-runs'),
  runGet:         id   => get(`/campaign-runs/${id}`),
  createRun:      data => post('/campaign-runs', data),
  updateRun:      (id, data) => put(`/campaign-runs/${id}`, data),
  deleteRun:      id   => del(`/campaign-runs/${id}`),
  lockRunSnapshot: (id, data) => post(`/campaign-runs/${id}/lock-snapshot`, data),
  syncRun:         (id, data) => post(`/campaign-runs/${id}/sync`, data),
  // `data` optionally carries `{ bypass_email_domain_guardrail: true }` — see
  // docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md FR-8. launch() is the only
  // action the wizard's UI actually calls; there's no separate lock/sync
  // step in the UI, so this is the one place that flag needs to be sendable from.
  launchRun:       (id, data) => post(`/campaign-runs/${id}/launch`, data),
  importRunTargets: (campaignRunId, targets) => post('/targets/import', { campaign_run_id: campaignRunId, targets }),

  // Single "Complete" lifecycle action (cancel/recall/complete merged into
  // one, see docs/PRD_CAMPAIGN_GROUP_MONITORING.md §6.4) — always ends in
  // status 'completed'. Distinct from the legacy `complete` above (that one
  // is the old pukat_campaigns table, unrelated to Campaign Run).
  runComplete:     id            => post(`/campaign-runs/${id}/complete`),
  runBulkComplete: ids           => post('/campaign-runs/bulk-complete', { ids }),
  runAssignGroup:  (id, groupId)      => post(`/campaign-runs/${id}/assign-group`, { campaign_group_id: groupId }),
  runBulkAssignGroup: (ids, groupId)  => post('/campaign-runs/bulk-assign-group', { ids, campaign_group_id: groupId }),
  runReport:          id => get(`/campaign-runs/${id}/report`),
  runReportExportPdf: id => get(`/campaign-runs/${id}/report/export`, { responseType: 'blob' }),
  // "Download data" (CSV/XLSX of Target details) — docs/PRD_MONITORING_DATA_EXPORT.md.
  runReportExportData: (id, format) => get(`/campaign-runs/${id}/report/export-data`, { params: { format }, responseType: 'blob' }),
  runSyncResults:     id => post(`/campaign-runs/${id}/sync-results`),
  runBulkSyncResults: ids => post('/campaign-runs/bulk-sync-results', { ids }),
}

export default campaignApi
