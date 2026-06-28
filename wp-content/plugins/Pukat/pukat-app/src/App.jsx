import React from 'react'
import AppAdmin    from './AppAdmin.jsx'
import AppFrontend from './AppFrontend.jsx'

/**
 * App — Root context switcher.
 *
 * Reads window.PukatData.context (injected by PHP):
 *  - 'admin'    → renders AppAdmin    (WP Admin Panel: UAM, Settings, GoPhish config)
 *  - 'frontend' → renders AppFrontend (Front Page /pukat: all operational features)
 *
 * Defaults to AppFrontend if context is missing or unrecognized.
 */
export default function App() {
  const context = window?.PukatData?.context ?? 'frontend'

  if (context === 'admin') {
    return <AppAdmin />
  }

  return <AppFrontend />
}
