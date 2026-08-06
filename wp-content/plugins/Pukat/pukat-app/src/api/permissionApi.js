import { get } from './client.js'

export const permissionApi = {
  mine: () => get('/me/permissions'),
}

export default permissionApi
