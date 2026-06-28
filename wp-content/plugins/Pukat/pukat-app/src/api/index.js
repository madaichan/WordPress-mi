import { get, post, del } from './client.js'
export { playbookApi } from './playbookApi.js'

export const campaignApi = {
  list:     (params)   => get('/campaigns', { params }),
  get:      (id)       => get(`/campaigns/${id}`),
  create:   (data)     => post('/campaigns', data),
  delete:   (id)       => del(`/campaigns/${id}`),
  launch:   (id, data) => post(`/campaigns/${id}/launch`, data),
  complete: (id)       => post(`/campaigns/${id}/complete`),
  results:  (id)       => get(`/campaigns/${id}/results`),
}

export const gophishApi = {
  status:          () => get('/gophish/status'),
  emailTemplates:  () => get('/gophish/templates/email'),
  landingPages:    () => get('/gophish/templates/landing'),
  smtpProfiles:    () => get('/gophish/smtp'),
  groups:          () => get('/gophish/groups'),
}

export const quizApi = {
  questions:     ()          => get('/quiz/questions'),
  createQuestion:(data)      => post('/quiz/questions', data),
  deleteQuestion:(id)        => del(`/quiz/questions/${id}`),
  submit:        (data)      => post('/quiz/submit', data),
  results:       (campaignId)=> get(`/quiz/results/${campaignId}`),
}

export const reportApi = {
  get:         (campaignId) => get(`/reports/${campaignId}`),
  export:      (campaignId) => get(`/reports/${campaignId}/export`),
  riskScores:  (params)     => get('/risk-scores', { params }),
  userRisk:    (email)      => get(`/risk-scores/${encodeURIComponent(email)}`),
}

export const settingsApi = {
  get:    ()     => get('/settings'),
  update: (data) => import('./client.js').then(({ put }) => put('/settings', data)),
}

export const userApi = {
  list:       (params)       => get('/users', { params }),
  updateRole: (id, role)     => import('./client.js').then(({ put }) => put(`/users/${id}/role`, { pukat_role: role })),
  auditLogs:  (params)       => get('/audit-logs', { params }),
}
