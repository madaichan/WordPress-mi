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
    const responseData = error.response?.data
    const message = responseData?.message || responseData?.code || error.message || 'An unknown error occurred.'
    const wrapped = new Error(message)
    // Extra fields beyond `message` a WP_Error can carry (see
    // RestController::from_wp_error()) — e.g. `code` to branch on a specific
    // failure without string-matching the message, `details`/`errors` for a
    // per-item breakdown (guardrail rejections, bulk validation). Every
    // existing caller only ever reads `.message`, so this is purely additive.
    wrapped.code = responseData?.code
    wrapped.status = error.response?.status
    wrapped.details = responseData?.details
    wrapped.errors = responseData?.errors
    return Promise.reject(wrapped)
  }
)

export default client

// Convenience helpers
export const get    = (url, config)       => client.get(url, config)
export const post   = (url, data, config) => client.post(url, data, config)
export const put    = (url, data, config) => client.put(url, data, config)
export const patch  = (url, data, config) => client.patch(url, data, config)
export const del    = (url, config)       => client.delete(url, config)
