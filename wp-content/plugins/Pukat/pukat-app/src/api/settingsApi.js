import { get, put } from './client.js'

export const settingsApi = {
  get:    ()     => get('/settings'),
  update: (data) => put('/settings', data),
}

export default settingsApi
