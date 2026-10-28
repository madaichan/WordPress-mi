/**
 * Chart colours and the shared tooltip for the quiz dashboard.
 *
 * The two series hues were validated, not eyeballed: #6C63FF (the app's own
 * violet-500) against #059669 passes the lightness band, chroma floor, CVD
 * separation (ΔE 24.9 deutan) and the 3:1 contrast floor on BOTH theme
 * surfaces — white and the dark panel's #161F38 — so one pair serves both
 * modes. Tritan separation sits in the 6–8 floor band, which is why every
 * chart using them also carries a legend and direct labels: identity is never
 * colour alone.
 *
 * Grid and axis lines deliberately take `currentColor` instead of a hex, so a
 * wrapper's text colour (a theme token) recolours them when the theme flips.
 */
export const SERIES = {
  score: '#6C63FF',
  passRate: '#059669',
}

/**
 * Tooltip body styled with theme tokens — recharts' default is inline-styled
 * white, which is unreadable in dark mode.
 */
export function ChartTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-semibold text-ink">{label}</p>
      {payload.map(entry => (
        <p key={entry.name} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}</span>
          <span className="font-semibold text-ink">{entry.value}{suffix}</span>
        </p>
      ))}
    </div>
  )
}
