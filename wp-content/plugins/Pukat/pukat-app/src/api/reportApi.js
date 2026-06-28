import { get } from './client.js'

export const reportApi = {
  get:        (campaignId) => get(`/reports/${campaignId}`),
  export:     (campaignId) => get(`/reports/${campaignId}/export`),
  riskScores: (params)     => get('/risk-scores', { params }),
  userRisk:   (email)      => get(`/risk-scores/${encodeURIComponent(email)}`),
}

export default reportApi
