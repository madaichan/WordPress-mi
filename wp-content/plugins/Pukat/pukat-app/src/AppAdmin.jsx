import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout/Layout.jsx'

// Admin-only pages
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard.jsx'))
const Users     = lazy(() => import('./pages/Admin/Users.jsx'))
const Settings  = lazy(() => import('./pages/Admin/Settings.jsx'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    </div>
  )
}

/**
 * AppAdmin — React SPA for the WordPress Admin Panel context.
 *
 * Accessible via: WP Admin → Pukat
 * Contains: Dashboard overview, User Access Management, Settings (GoPhish API, etc.)
 */
export default function AppAdmin() {
  return (
    <HashRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '10px',
            fontSize: '14px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7' },
          },
          error: {
            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' },
          },
        }}
      />
      <Layout context="admin">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Index + /dashboard both render the dashboard */}
            <Route index element={<Dashboard />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/admin/users"   element={<Users />} />
            <Route path="/admin/settings" element={<Settings />} />

            {/* Catch-all → dashboard */}
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  )
}
