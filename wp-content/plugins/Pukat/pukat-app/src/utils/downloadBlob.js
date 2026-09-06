/**
 * Trigger a browser download for a Blob already fetched from the API (e.g.
 * the PDF export endpoints, see docs/PRD_CAMPAIGN_GROUP_MONITORING.md §7.5).
 * Unlike the CSV export convention elsewhere in this app (JSON rows +
 * filename, built into a file client-side), these endpoints return the
 * binary file directly — this just needs to hand it to the browser.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default downloadBlob
