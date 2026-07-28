import { get } from './client.js'

export const tableApi = {
  schema: (tableKey) => get(`/tables/${tableKey}/schema`),
  rows: (tableKey, params = {}) => get(`/tables/${tableKey}/rows`, { params }),
}

export default tableApi
