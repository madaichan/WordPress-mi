/**
 * fallbacks.js
 *
 * Static fallback data used when API responses are empty or unavailable.
 * Centralizes demo/placeholder data that was previously duplicated across
 * every Admin Master page.
 *
 * Used by:
 *  - src/pages/Admin/MasterEmailTemplates.jsx
 *  - src/pages/Admin/MasterAssetPage.jsx
 *  - src/pages/Admin/MasterLandingPages.jsx
 *  - src/pages/Admin/MasterSendingProfiles.jsx
 */

/**
 * Placeholder users shown when the WP REST API returns no users
 * (e.g. during local development or before the plugin is fully configured).
 *
 * Shape matches the userApi.list() response item:
 *  { id, display_name, email, pukat_role }
 */
export const FALLBACK_USERS = [
  { id: 1, display_name: 'Admin User',    email: 'admin@example.com',    pukat_role: 'pukat_admin' },
  { id: 2, display_name: 'Operator User', email: 'operator@example.com', pukat_role: 'pukat_operator' },
  { id: 3, display_name: 'Viewer User',   email: 'viewer@example.com',   pukat_role: 'pukat_viewer' },
]
