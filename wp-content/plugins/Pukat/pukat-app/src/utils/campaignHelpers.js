/**
 * campaignHelpers.js
 *
 * Shared display helpers for campaign status, dot indicators, and date formatting.
 * Extracted from Dashboard.jsx and Campaigns.jsx to eliminate duplication.
 *
 * Used by:
 *  - src/pages/Dashboard/Dashboard.jsx
 *  - src/pages/Simulation/Campaigns.jsx
 */

import { parseServerDate } from './serverDate.js'

/**
 * Returns a display label and Tailwind badge class for a campaign status string.
 *
 * @param {string} status - 'active' | 'completed' | 'paused' | 'draft' | 'scheduled'
 * @returns {{ label: string, cls: string }}
 */
export function statusLabel(status) {
  switch (status) {
    case 'active':    return { label: 'Running',   cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' }
    case 'completed': return { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' }
    case 'paused':    return { label: 'Paused',    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' }
    case 'draft':     return { label: 'Draft',     cls: 'bg-panel-muted text-ink-muted' }
    default:          return { label: 'Scheduled', cls: 'bg-panel-muted text-ink-muted' }
  }
}

/**
 * Returns a Tailwind background class for the dot indicator of a campaign status.
 *
 * @param {string} status - 'active' | 'completed' | 'paused' | any
 * @returns {string} Tailwind bg-* class
 */
export function dotColor(status) {
  if (status === 'active')    return 'bg-blue-500'
  if (status === 'completed') return 'bg-emerald-500'
  if (status === 'paused')    return 'bg-amber-500'
  return 'bg-ink-faint'
}

/**
 * Formats an ISO date string or Date-compatible value into a localized short date.
 *
 * @param {string|Date|null|undefined} date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string|null} Formatted date string, or null if date is falsy
 */
export function formatDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const parsed = parseServerDate(date)
  if (!parsed) return null
  return parsed.toLocaleDateString('en-US', options)
}
