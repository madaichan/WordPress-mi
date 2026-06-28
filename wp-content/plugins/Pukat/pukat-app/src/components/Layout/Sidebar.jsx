import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import useAppStore from '../../store/useAppStore.js'
import GoPhishStatus from '../GoPhishStatus.jsx'

/**
 * Navigation items for the Admin Panel — management features only.
 * Operational features (Campaigns, Simulation, etc.) live on the Front Page.
 */
const NAV = [
  {
    group: 'Overview',
    items: [
      { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { to: '/admin/users',    icon: 'ti-users',    label: 'User Access' },
      { to: '/admin/settings', icon: 'ti-settings', label: 'Settings' },
    ],
  },
]

export default function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggle    = useAppStore((s) => s.toggleSidebar)

  return (
    <aside
      className={clsx(
        'sidebar transition-all duration-300 overflow-hidden no-scrollbar',
        collapsed ? 'w-16' : 'w-[220px]'
      )}
    >
      {/* Brand */}
      <div className="h-14 flex items-center border-b border-white/10 flex-shrink-0 px-4 gap-2.5">
        <i className="ti ti-shield-alert text-violet-400 text-xl flex-shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-white tracking-tight whitespace-nowrap overflow-hidden">
            Flow beyond
          </span>
        )}
        <button
          onClick={toggle}
          className={clsx(
            'ml-auto text-gray-500 hover:text-gray-300 transition-colors p-1 rounded',
            collapsed && 'mx-auto'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <i className={clsx('ti', collapsed ? 'ti-layout-sidebar-right' : 'ti-layout-sidebar')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto no-scrollbar space-y-5">
        {NAV.map(({ group, items }) => (
          <div key={group} className="space-y-0.5">
            {!collapsed && (
              <p className="nav-group-label">{group}</p>
            )}
            {items.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'nav-item',
                    isActive && 'active',
                    collapsed && 'justify-center px-0 mx-2'
                  )
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

      {/* Footer: link to front page + GoPhish status */}
      <div className={clsx(
        'border-t border-white/10 p-3 flex-shrink-0 space-y-2',
        collapsed ? 'flex flex-col items-center' : ''
      )}>
        {/* Quick link to Front Page */}
        <a
          href={`${window?.location?.origin ?? ''}/pukat`}
          className={clsx(
            'flex items-center gap-2 text-xs text-gray-500 hover:text-violet-400 transition-colors py-1 rounded',
            collapsed ? 'justify-center' : 'px-2'
          )}
          title="Open Front Page"
        >
          <i className="ti ti-external-link text-sm flex-shrink-0" />
          {!collapsed && <span>Open App (/pukat)</span>}
        </a>
        <GoPhishStatus collapsed={collapsed} />
      </div>
    </aside>
  )
}
