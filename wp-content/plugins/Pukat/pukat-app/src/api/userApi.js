import { get, put } from './client.js'

export const userApi = {
  list:       (params)   => get('/users', { params }),
  updateRole: (id, role) => put(`/users/${id}/role`, { pukat_role: role }),
  auditLogs:  (params)   => get('/audit-logs', { params }),
}

export default userApi
