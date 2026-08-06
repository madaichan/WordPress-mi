import { get, post, put, del } from './client.js'

export const roleApi = {
  list:               ()           => get('/roles'),
  create:             (data)       => post('/roles', data),
  update:             (slug, data) => put(`/roles/${slug}`, data),
  remove:             (slug)       => del(`/roles/${slug}`),
  permissionRegistry: ()           => get('/permissions/registry'),
}

export default roleApi
