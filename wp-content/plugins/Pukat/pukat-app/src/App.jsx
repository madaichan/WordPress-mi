import React, { useEffect, useState } from 'react'
import AppAdmin    from './AppAdmin.jsx'
import AppFrontend from './AppFrontend.jsx'
import PageLoader from './components/UI/PageLoader.jsx'
import { useMyPermissions } from './hooks/queries/usePermissionQueries.js'
import useAppStore from './store/useAppStore.js'

/**
 * App — Root context switcher.
 *
 * Reads window.PukatData.context (injected by PHP):
 *  - 'admin'    → renders AppAdmin    (WP Admin Panel: UAM, Settings, GoPhish config)
 *  - 'frontend' → renders AppFrontend (Front Page /pukat: all operational features)
 *
 * Defaults to AppFrontend if context is missing or unrecognized.
 *
 * Blocks on fetching the current user's RBAC permissions (GET /me/permissions)
 * before mounting either app — nav filtering and route guards both read
 * useAppStore's `permissions`, so they need it populated before the first
 * render of a real route, not racing it. A fetch failure sets an empty
 * permission set (fail closed: nav/routes end up locked down, not wide open).
 */
export default function App() {
  const context = window?.PukatData?.context ?? 'frontend'
  const { data, isError } = useMyPermissions()
  const [permissionsHydrated, setPermissionsHydrated] = useState(false)
  const setPermissions = useAppStore((s) => s.setPermissions)
  const permissionsReady = Boolean(data) || isError

  useEffect(() => {
    if (data?.permissions) {
      setPermissions(data.permissions)
      setPermissionsHydrated(true)
    } else if (isError) {
      setPermissions([])
      setPermissionsHydrated(true)
    }
  }, [data, isError, setPermissions])

  if (!permissionsReady || !permissionsHydrated) {
    return <PageLoader />
  }

  if (context === 'admin') {
    return <AppAdmin />
  }

  return <AppFrontend />
}
