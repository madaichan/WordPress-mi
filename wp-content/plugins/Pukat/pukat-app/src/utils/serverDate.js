/**
 * serverDate.js
 *
 * Backend timestamps (created_at, synced_at, launched_at, etc.) are stored
 * in UTC via PHP's `current_time( 'mysql', true )` and come back as naive
 * "Y-m-d H:i:s" strings with no timezone marker — see
 * CampaignRunService::sync_results_for_run() and friends. A bare
 * `new Date(value)` on a string like that is parsed as the browser's local
 * time, not UTC, so every "time ago" / formatted date ends up off by the
 * viewer's UTC offset. GoPhish-sourced timestamps (opened_at, clicked_at...)
 * already carry their own offset/zone and are left untouched.
 */

/**
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
export function parseServerDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  const str = String(value).trim()
  if (!str) return null

  // Date-only "Y-m-d" is already UTC per the Date Time String spec (unlike a
  // datetime with no zone, which is local) — leave it to the native parser.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const date = new Date(str)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(str)
  const iso = str.includes(' ') ? str.replace(' ', 'T') : str
  const date = new Date(hasZone ? iso : `${iso}Z`)

  return Number.isNaN(date.getTime()) ? null : date
}
