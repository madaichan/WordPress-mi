/**
 * Axios client pre-configured for WordPress REST API.
 * Automatically injects the WP nonce and base URL from window.PukatData.
 */
import axios from 'axios'

// PukatData is injected by wp_localize_script in AdminPage.php
const data = window.PukatData || {
  restUrl: '/wp-json/pukat/v1',
  nonce: '',
}

const client = axios.create({
  baseURL: data.restUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-WP-Nonce': data.nonce,
  },
})

// Response interceptor — unwrap the {success, data} envelope
client.interceptors.response.use(
  (response) => {
    const body = response.data
    // Our API always returns { success: true, data: ... }
    if (body && typeof body === 'object' && 'data' in body) {
      return body.data
    }
    return body
  },
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.code ||
      error.message ||
      'An unknown error occurred.'
    return Promise.reject(new Error(message))
  }
)

export default client

// Convenience helpers
export const get    = (url, config)       => client.get(url, config)
export const post   = (url, data, config) => client.post(url, data, config)
export const put    = (url, data, config) => client.put(url, data, config)
export const del    = (url, config)       => client.delete(url, config)
