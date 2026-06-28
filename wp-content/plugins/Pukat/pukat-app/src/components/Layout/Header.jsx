import React from 'react'
import { useLocation } from 'react-router-dom'
import useAppStore from '../../store/useAppStore.js'

// Map route prefixes → readable page titles
const PAGE_TITLES = {
  '/dashboard':              { title: 'Dashboard',         subtitle: 'Platform overview and key metrics' },
  '/campaigns':              { title: 'Campaigns',          subtitle: 'Manage all phishing simulation campaigns' },
  '/monitoring':             { title: 'Sending profiles',   subtitle: 'SMTP relay configuration for GoPhish delivery' },
  '/simulation/preparation': { title: 'Preparation',        subtitle: 'Import targets and configure templates' },
  '/simulation/performing':  { title: 'Performing',         subtitle: 'Launch and monitor active campaigns' },
  '/reports':                { title: 'Reports',            subtitle: 'Analytics, risk scores, and exports' },
  '/post/quiz':              { title: 'Quiz Module',         subtitle: 'Question bank and quiz results' },
  '/post/coaching':          { title: 'Coaching',           subtitle: 'Training assignments for high-risk users' },
  '/pre/socialization':      { title: 'Socialization',      subtitle: 'Pre-simulation awareness campaigns' },
  '/playbooks':              { title: 'Playbooks',          subtitle: 'Reusable campaign templates' },
  '/setup/playbooks':        { title: 'Playbooks',          subtitle: 'Reusable campaign templates' },
  '/admin/users':            { title: 'User Access',        subtitle: 'Role-based access control' },
  '/admin/settings':         { title: 'Settings',           subtitle: 'Global configuration and GoPhish connection' },
}

export default function Header() {
  const { pathname } = useLocation()
  const user = useAppStore((s) => s.user)

  // Find the best-matching title
  const match = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))
  const { title, subtitle } = match?.[1] ?? { title: 'Pukat', subtitle: '' }

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
          {user.role}
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
