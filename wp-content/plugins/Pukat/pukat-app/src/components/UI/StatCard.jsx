import React from 'react'

/**
 * StatCard — Reusable metric card for dashboards and overview pages.
 *
 * Props:
 *  icon       {string}  Tabler icon class without "ti " prefix, e.g. "ti-users"
 *  iconBg     {string}  Tailwind bg class for icon container, e.g. "bg-violet-500/15"
 *  iconColor  {string}  Tailwind text class for icon, e.g. "text-violet-600 dark:text-violet-400"
 *  label      {string}  Metric label shown above the value
 *  value      {string|number|null}  Main metric value; null shows a loading skeleton
 *  sub        {string}  Optional secondary line below value
 *  subColor   {string}  Optional Tailwind text class for sub line (default: text-ink-faint)
 *  trend      {string}  Reserved for future trend indicator (not rendered yet)
 */
export default function StatCard({ icon, iconBg, iconColor, label, value, sub, subColor }) {
  return (
    <div className="stat-card card-hover cursor-default">
      <div className={`stat-icon ${iconBg}`}>
        <i className={`ti ${icon} text-xl ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-ink-muted truncate">{label}</p>
        <p className="text-2xl font-bold text-ink leading-tight">
          {value ?? <span className="inline-block w-12 h-6 bg-panel-muted rounded animate-pulse" />}
        </p>
        {sub && (
          <p className={`text-xs font-semibold truncate ${subColor ?? 'text-ink-faint'}`}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}
