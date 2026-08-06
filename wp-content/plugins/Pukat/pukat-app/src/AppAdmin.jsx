import { Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout.jsx'
import PageLoader from './components/UI/PageLoader.jsx'
import AppToaster from './components/UI/AppToaster.jsx'
import PermissionRoute from './components/UI/PermissionRoute.jsx'
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
            {adminRoutes.map(route => {
              const element = route.permission
                ? <PermissionRoute permission={route.permission}>{route.element}</PermissionRoute>
                : route.element
              return route.index
                ? <Route key="index" index element={element} />
                : <Route key={route.path} path={route.path} element={element} />
            })}
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  )
}
