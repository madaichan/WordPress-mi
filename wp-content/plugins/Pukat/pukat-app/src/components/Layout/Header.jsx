import React from 'react'
import { useLocation } from 'react-router-dom'
import useAppStore from '../../store/useAppStore.js'
import { getRouteMeta } from '../../config/routeMeta.js'
import { getPukatRoleLabel } from '../../utils/roles.js'

export default function Header() {
  const { pathname } = useLocation()
  const user = useAppStore((s) => s.user)

  const { title, subtitle } = getRouteMeta(pathname, { title: 'Pukat', subtitle: '' })

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-20">
      {/* Page title */}
      <div>
        <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Role badge */}
        <span className="badge badge-violet capitalize text-xs hidden sm:inline-flex">
          <i className="ti ti-shield-check text-xs" />
          {getPukatRoleLabel(user.role)}
        </span>

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-semibold text-sm">
            {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:block">
            {user.displayName}
          </span>
        </div>
      </div>
    </header>
  )
}
