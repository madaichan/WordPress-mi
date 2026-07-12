import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import GoPhishStatus from '../GoPhishStatus.jsx'
import SidebarBrand from './SidebarBrand.jsx'
import SidebarNav from './SidebarNav.jsx'
import { getRouteMeta } from '../../config/routeMeta.js'
import { frontendNavGroups } from '../../config/appRoutes.jsx'

/**
 * FrontendLayout — Standalone full-page layout for the /pukat front page.
 *
 * This layout renders completely independently of WordPress admin — it's a
 * self-contained shell with its own sidebar, topbar, and main content area.
 */
export default function FrontendLayout({ children }) {
  const { pathname } = useLocation()
  const { breadcrumb: activeLabel } = getRouteMeta(pathname, { breadcrumb: 'Dashboard' })

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sidebar ── */}
      <aside className="sidebar overflow-hidden no-scrollbar fixed top-0 left-0 h-screen z-30 w-[220px]">
        {/* Brand */}
        <SidebarBrand
          className="h-14 flex items-center px-5 border-b border-gray-800 gap-2 flex-shrink-0"
          iconClassName="text-violet-500 text-lg"
          textClassName="font-semibold text-white tracking-tight"
        />

        {/* Navigation */}
        <SidebarNav groups={frontendNavGroups} defaultEnd groupGapClassName="space-y-1" />

        <div className="p-4 border-t border-gray-800/80 bg-navy-light/10 text-xs">
          <GoPhishStatus />
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
