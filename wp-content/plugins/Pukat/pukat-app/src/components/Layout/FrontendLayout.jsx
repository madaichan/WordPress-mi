import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'

/**
 * Navigation items for the Front Page — all operational features.
 * Admin items (UAM, Settings, GoPhish Config) are intentionally excluded.
 */
const NAV = [
  {
    group: 'Overview',
    items: [
      { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
      { to: '/calendar', icon: 'ti-calendar', label: 'Simulation calendar' },
    ],
  },
  {
    group: 'Simulation',
    items: [
      { to: '/campaigns',       icon: 'ti-circle-plus', label: 'New campaign' },
      { to: '/playbooks',       icon: 'ti-book',        label: 'Playbooks' },
      { to: '/monitoring',      icon: 'ti-send',        label: 'Sending profiles' },
      { to: '/email-templates', icon: 'ti-mail',        label: 'Email templates' },
      { to: '/landing-pages',   icon: 'ti-browser',     label: 'Landing pages' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { to: '/reports', icon: 'ti-chart-bar', label: 'Simulation report' },
    ],
  },
  {
    group: 'Post Sim',
    items: [
      { to: '/post/quiz',      icon: 'ti-help-circle', label: 'Quiz' },
      { to: '/post/coaching',  icon: 'ti-school',      label: 'Coaching' },
      { to: '/next-planning',  icon: 'ti-map-2',       label: 'Next planning' },
    ],
  },
]

const BREADCRUMBS = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Simulation calendar',
  '/campaigns': 'New campaign',
  '/playbooks': 'Playbooks',
  '/monitoring': 'Sending profiles',
  '/email-templates': 'Email templates',
  '/landing-pages': 'Landing pages',
  '/reports': 'Simulation report',
  '/post/quiz': 'Quiz',
  '/post/coaching': 'Coaching',
  '/next-planning': 'Next planning',
  '/setup/playbooks': 'Playbooks',
  '/simulation/performing': 'Monitoring',
}

/**
 * FrontendLayout — Standalone full-page layout for the /pukat front page.
 *
 * This layout renders completely independently of WordPress admin — it's a
 * self-contained shell with its own sidebar, topbar, and main content area.
 */
export default function FrontendLayout({ children }) {
  const { pathname } = useLocation()
  const activeLabel = BREADCRUMBS[pathname] ?? 'Dashboard'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sidebar ── */}
      <aside className="sidebar overflow-hidden no-scrollbar fixed top-0 left-0 h-screen z-30 w-[220px]">
        {/* Brand */}
        <div className="h-14 flex items-center px-5 border-b border-gray-800 gap-2 flex-shrink-0">
          <i className="ti ti-shield-alert text-violet-500 text-lg flex-shrink-0" />
          <span className="font-semibold text-white tracking-tight">Flow beyond</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar space-y-5">
          {NAV.map(({ group, items }) => (
            <div key={group} className="space-y-1">
              <p className="nav-group-label">{group}</p>
              {items.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to !== '/reports'}
                  className={({ isActive }) =>
                    clsx(
                      'nav-item',
                      isActive && 'active'
                    )
                  }
                >
                  <i className={clsx('ti', icon, 'text-base flex-shrink-0')} />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800/80 bg-navy-light/10 text-xs">
          <div className="flex items-center justify-between text-gray-500">
            <span>GoPhish engine</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-1 text-[10px] text-gray-600">v0.12.0 • plugin v1.0</div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="fixed top-0 left-[220px] right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
          <NavLink to="/dashboard" className="hover:text-gray-900">Flow beyond</NavLink>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold">{activeLabel}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>WordPress plugin</span>
          </div>
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xs text-gray-700 select-none">
            WP
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="ml-[220px] pt-14 p-6 min-h-screen bg-gray-50 animate-fade-in">
        {children}
      </main>
    </div>
  )
}
