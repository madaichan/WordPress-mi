import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

/**
 * SidebarNav.jsx
 *
 * Grouped NavLink list shared by the Admin sidebar (Sidebar.jsx, collapsible)
 * and Frontend sidebar (FrontendLayout.jsx, always expanded).
 *
 * - `collapsed` toggles Sidebar.jsx's icon-only compact mode (hides group
 *   labels and item text, adds a title tooltip).
 * - `defaultEnd` sets the NavLink `end` matching mode for items that don't
 *   specify their own `end`. Sidebar.jsx relies on the default `end={false}`
 *   (prefix match). FrontendLayout.jsx wants exact match for most items but
 *   prefix match for its '/reports' item specifically, so nested report
 *   detail routes (e.g. /reports/:campaignId) still highlight it — that item
 *   carries its own `end: false` in FrontendLayout's NAV data to override
 *   `defaultEnd`.
 * - `groupGapClassName` preserves each sidebar's pre-existing (and slightly
 *   different) vertical spacing between nav groups.
 */
export default function SidebarNav({ groups, collapsed = false, defaultEnd = false, groupGapClassName = 'space-y-0.5' }) {
  return (
    <nav className="flex-1 py-4 overflow-y-auto no-scrollbar space-y-5">
      {groups.map(({ group, items }) => (
        <div key={group} className={groupGapClassName}>
          {!collapsed && <p className="nav-group-label">{group}</p>}
          {items.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end ?? defaultEnd}
              className={({ isActive }) =>
                clsx('nav-item', isActive && 'active', collapsed && 'justify-center px-0 mx-2')
              }
              title={collapsed ? label : undefined}
            >
              <i className={clsx('ti', icon, 'text-base flex-shrink-0')} />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
