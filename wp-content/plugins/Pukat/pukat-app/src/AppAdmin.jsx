import { Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout.jsx'
import PageLoader from './components/UI/PageLoader.jsx'
import AppToaster from './components/AppToaster.jsx'
import { adminRoutes } from './config/appRoutes.jsx'


/**
 * AppAdmin — React SPA for the WordPress Admin Panel context.
 *
 * Accessible via: WP Admin → Pukat
 * Contains: Dashboard overview, User Access Management, Settings (GoPhish API, etc.)
 */
export default function AppAdmin() {
  return (
    <HashRouter>
      <AppToaster />
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {adminRoutes.map(route => (
              route.index
                ? <Route key="index" index element={route.element} />
                : <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  )
}
