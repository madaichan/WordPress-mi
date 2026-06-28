import { Suspense, lazy } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import FrontendLayout from './components/Layout/FrontendLayout.jsx'

// Frontend (operational) pages
const Dashboard     = lazy(() => import('./pages/Dashboard/Dashboard.jsx'))
const Calendar      = lazy(() => import('./pages/Simulation/Calendar.jsx'))
const Campaigns     = lazy(() => import('./pages/Simulation/Campaigns.jsx'))
const Preparation   = lazy(() => import('./pages/Simulation/Preparation.jsx'))
const Performing    = lazy(() => import('./pages/Simulation/Performing.jsx'))
const Reports       = lazy(() => import('./pages/Simulation/Reports.jsx'))
const EmailTemplates = lazy(() => import('./pages/Simulation/EmailTemplates.jsx'))
const LandingPages  = lazy(() => import('./pages/Simulation/LandingPages.jsx'))
const Quiz          = lazy(() => import('./pages/PostSimulation/Quiz.jsx'))
const Coaching      = lazy(() => import('./pages/PostSimulation/Coaching.jsx'))
const NextPlanning  = lazy(() => import('./pages/PostSimulation/NextPlanning.jsx'))
const Socialization = lazy(() => import('./pages/PreSimulation/Socialization.jsx'))
const Playbooks     = lazy(() => import('./features/setup/playbooks/Playbooks.jsx'))

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
 * AppFrontend — React SPA for the public front page context.
 *
 * Accessible via: http://your-site.com/pukat
 * Contains: All operational features — Dashboard, Pre/Simulation, Post-Simulation, Setup.
 * Admin features (UAM, Settings) are NOT included here.
 */
export default function AppFrontend() {
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
      <FrontendLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Index + /dashboard both render the dashboard */}
            <Route index element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />

            {/* Pre-Simulation */}
            <Route path="/pre/socialization" element={<Socialization />} />

            {/* Simulation */}
            <Route path="/campaigns"              element={<Campaigns />} />
            <Route path="/playbooks"              element={<Playbooks />} />
            <Route path="/monitoring"             element={<Performing />} />
            <Route path="/email-templates"        element={<EmailTemplates />} />
            <Route path="/landing-pages"          element={<LandingPages />} />
            <Route path="/simulation/preparation" element={<Preparation />} />
            <Route path="/simulation/performing"  element={<Performing />} />
            <Route path="/reports"                element={<Reports />} />
            <Route path="/reports/:campaignId"    element={<Reports />} />

            {/* Post-Simulation */}
            <Route path="/post/quiz"     element={<Quiz />} />
            <Route path="/post/coaching" element={<Coaching />} />
            <Route path="/next-planning" element={<NextPlanning />} />

            {/* Backward-compatible setup route */}
            <Route path="/setup/playbooks" element={<Playbooks />} />

            {/* Catch-all → dashboard */}
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </FrontendLayout>
    </HashRouter>
  )
}
