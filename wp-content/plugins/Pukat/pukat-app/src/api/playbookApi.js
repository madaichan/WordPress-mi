import { get, post, put } from './client.js'

export const playbookApi = {
  list:   ()      => get('/playbook-masters'),
  get:    (id)    => get(`/playbook-masters/${id}`),
  create: (data)  => post('/playbook-masters', data),
  update: (id, d) => put(`/playbook-masters/${id}`, d),
  delete: (id)    => post(`/playbook-masters/${id}/archive`),
}

export default playbookApi
