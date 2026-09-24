import { Navigate, useLocation } from 'react-router-dom'
import useAppStore from '../../store/useAppStore.js'
import EmptyState from './EmptyState.jsx'

/**
 * Route guard — redirects to /dashboard if the current user doesn't hold
 * `permission`. Frontend-only UX guard, not enforcement: the backend's own
 * permission_callback on each REST route is the real authority (AGENTS.md
 * §5.1) — this only stops a role from *navigating* to a page it has no
 * working access to, e.g. by typing a hash URL directly.
 */
export default function PermissionRoute({ permission, children }) {
  const permissions = useAppStore((state) => state.permissions)
  const { pathname } = useLocation()

  if (!permission || permissions.includes(permission)) {
    return children
  }

  // /dashboard is the redirect target below — a role missing dashboard.view
  // would otherwise bounce back to /dashboard forever. Show the forbidden
  // state in place instead of looping.
  if (pathname === '/dashboard') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon="ti-lock"
          title="You do not have access to this page"
          description="Contact your administrator if you believe this is a mistake."
        />
      </div>
    )
  }

  return <Navigate to="/dashboard" replace />
}
