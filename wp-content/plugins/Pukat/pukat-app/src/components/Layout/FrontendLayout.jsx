import React from 'react'
import { useLocation } from 'react-router-dom'
import GoPhishStatus from '../UI/GoPhishStatus.jsx'
import SidebarBrand from './SidebarBrand.jsx'
import SidebarNav from './SidebarNav.jsx'
import Topbar from './Topbar.jsx'
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
    <div className="flex min-h-screen bg-gray-50">

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

      {/* Main content — offset by sidebar width, same shape as admin's Layout.jsx */}
      <div className="ml-[220px] flex flex-1 flex-col" style={{ minHeight: '100vh' }}>
        <Topbar activeLabel={activeLabel} className="sticky top-0" />
        <main className="flex-1 p-6 overflow-y-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
