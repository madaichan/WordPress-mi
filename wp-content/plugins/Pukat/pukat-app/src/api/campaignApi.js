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
}

export default campaignApi
