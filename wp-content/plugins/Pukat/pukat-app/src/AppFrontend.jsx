import { Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import FrontendLayout from './components/Layout/FrontendLayout.jsx'
import PageLoader from './components/UI/PageLoader.jsx'
import AppToaster from './components/UI/AppToaster.jsx'
import { frontendRoutes } from './config/appRoutes.jsx'


/**
 * AppFrontend — React SPA for the public front page context.
 *
 * Accessible via: http://your-site.com/pukat
 * Contains: All operational features — Dashboard, Pre/Simulation, Post-Simulation, Setup.
 * Admin features (UAM, Settings) are NOT included here.
 */
export default function AppFrontend() {
  return (
    <HashRouter>
      <AppToaster />
      <FrontendLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {frontendRoutes.map(route => (
              route.index
                ? <Route key="index" index element={route.element} />
                : <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </Suspense>
      </FrontendLayout>
    </HashRouter>
  )
}
