import { Navigate } from 'react-router-dom'
import useAppStore from '../../store/useAppStore.js'

/**
 * Route guard — redirects to /dashboard if the current user doesn't hold
 * `permission`. Frontend-only UX guard, not enforcement: the backend's own
 * permission_callback on each REST route is the real authority (AGENTS.md
 * §5.1) — this only stops a role from *navigating* to a page it has no
 * working access to, e.g. by typing a hash URL directly.
 */
export default function PermissionRoute({ permission, children }) {
  const permissions = useAppStore((state) => state.permissions)

  if (!permission || permissions.includes(permission)) {
    return children
  }

  return <Navigate to="/dashboard" replace />
}
