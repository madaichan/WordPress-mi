import { get, put, post } from './client.js'

export const profileApi = {
  get:            ()      => get('/me'),
  update:         (data)  => put('/me', data),
  changePassword: (data)  => post('/me/change-password', data),
}

export default profileApi
