import { get, post, put } from './client.js'

export const playbookApi = {
  list:   ()      => get('/playbook-masters'),
  get:    (id)    => get(`/playbook-masters/${id}`),
  create: (data)  => post('/playbook-masters', data),
  update: (id, d) => put(`/playbook-masters/${id}`, d),
  duplicate: (id, data = {}) => post(`/playbook-masters/${id}/duplicate`, data),
  delete: (id)    => post(`/playbook-masters/${id}/archive`),
  submitReview: (id) => post(`/playbook-masters/${id}/submit-review`),
  approve:      (id) => post(`/playbook-masters/${id}/approve`),
}

export default playbookApi
