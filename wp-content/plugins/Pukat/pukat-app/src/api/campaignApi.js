import { get, post, del } from './client.js'

export const campaignApi = {
  list:     (params)   => get('/campaigns', { params }),
  get:      (id)       => get(`/campaigns/${id}`),
  create:   (data)     => post('/campaigns', data),
  delete:   (id)       => del(`/campaigns/${id}`),
  launch:   (id, data) => post(`/campaigns/${id}/launch`, data),
  complete: (id)       => post(`/campaigns/${id}/complete`),
  results:  (id)       => get(`/campaigns/${id}/results`),

  runList:        ()   => get('/campaign-runs'),
  createRun:      data => post('/campaign-runs', data),
  lockRunSnapshot: id  => post(`/campaign-runs/${id}/lock-snapshot`),
  syncRun:         id  => post(`/campaign-runs/${id}/sync`),
  launchRun:       id  => post(`/campaign-runs/${id}/launch`),
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
  runSyncResults:     id => post(`/campaign-runs/${id}/sync-results`),
}

export default campaignApi
