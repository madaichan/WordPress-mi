import { get, post, put, del } from './client.js'

export const playbookApi = {
  list:   ()      => get('/playbooks'),
  get:    (id)    => get(`/playbooks/${id}`),
  create: (data)  => post('/playbooks', data),
  update: (id, d) => put(`/playbooks/${id}`, d),
  delete: (id)    => del(`/playbooks/${id}`),
}

export default playbookApi
