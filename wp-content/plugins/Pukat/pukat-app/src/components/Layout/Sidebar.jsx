import React from 'react'
import clsx from 'clsx'
import useAppStore from '../../store/useAppStore.js'
import GoPhishStatus from '../UI/GoPhishStatus.jsx'
import SidebarBrand from './SidebarBrand.jsx'
import SidebarNav from './SidebarNav.jsx'
import { adminNavGroups, adminRoutePermissions, filterNavGroupsByPermission } from '../../config/appRoutes.jsx'

export default function Sidebar() {
  const collapsed   = useAppStore((s) => s.sidebarCollapsed)
  const toggle      = useAppStore((s) => s.toggleSidebar)
  const permissions = useAppStore((s) => s.permissions)
  const navGroups   = filterNavGroupsByPermission(adminNavGroups, adminRoutePermissions, permissions)

  return (
    <aside
      className={clsx(
        'sidebar transition-all duration-300 overflow-hidden no-scrollbar',
        collapsed ? 'w-16' : 'w-[220px]'
      )}
    >
      {/* Brand */}
      <SidebarBrand
        className="h-14 flex items-center border-b border-white/10 flex-shrink-0 px-4 gap-2.5"
        iconClassName="text-violet-400 text-xl"
        textClassName="font-semibold text-white tracking-tight whitespace-nowrap overflow-hidden"
        collapsed={collapsed}
        toggle={toggle}
        toggleTitle={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      />

      {/* Navigation */}
      <SidebarNav groups={navGroups} collapsed={collapsed} />

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
