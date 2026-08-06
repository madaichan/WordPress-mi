import { lazy } from 'react'

const Dashboard = lazy(() => import('../pages/Dashboard/Dashboard.jsx'))
const Users = lazy(() => import('../pages/Admin/Users.jsx'))
const Roles = lazy(() => import('../pages/Admin/Roles.jsx'))
const Settings = lazy(() => import('../pages/Admin/Settings.jsx'))
const MasterAssetPage = lazy(() => import('../pages/Admin/MasterAssetPage.jsx'))
const MasterSendingProfiles = lazy(() => import('../pages/Admin/MasterSendingProfiles.jsx'))
const MasterEmailTemplates = lazy(() => import('../pages/Admin/MasterEmailTemplates.jsx'))
const MasterLandingPages = lazy(() => import('../pages/Admin/MasterLandingPages.jsx'))
const MasterDomains = lazy(() => import('../pages/Admin/MasterDomains.jsx'))

const Calendar = lazy(() => import('../pages/Simulation/Calendar.jsx'))
const Campaigns = lazy(() => import('../pages/Simulation/Campaigns.jsx'))
const Preparation = lazy(() => import('../pages/Simulation/Preparation.jsx'))
const Performing = lazy(() => import('../pages/Simulation/Performing.jsx'))
const Reports = lazy(() => import('../pages/Simulation/Reports.jsx'))
const SendingProfiles = lazy(() => import('../pages/Simulation/SendingProfiles.jsx'))
const EmailTemplates = lazy(() => import('../pages/Simulation/EmailTemplates.jsx'))
const LandingPages = lazy(() => import('../pages/Simulation/LandingPages.jsx'))
const Quiz = lazy(() => import('../pages/PostSimulation/Quiz.jsx'))
const Coaching = lazy(() => import('../pages/PostSimulation/Coaching.jsx'))
const NextPlanning = lazy(() => import('../pages/PostSimulation/NextPlanning.jsx'))
const Socialization = lazy(() => import('../pages/PreSimulation/Socialization.jsx'))
const Playbooks = lazy(() => import('../features/setup/playbooks/Playbooks.jsx'))

// Every guarded route names the Permission Registry key it requires (see
// includes/Services/PermissionRegistry.php on the backend — this is the same
// catalog, just consumed for frontend UX). `*` is deliberately left
// unguarded: it already just falls back to Dashboard, and wrapping it too
// would self-redirect to /dashboard on the same navigation for a role that
// somehow lacks dashboard.view (every seeded role has it, but no reason to
// build a redirect loop on an edge case that shouldn't exist).
export const adminRoutes = [
  { index: true, element: <Dashboard />, permission: 'dashboard.view' },
  { path: '/dashboard', element: <Dashboard />, permission: 'dashboard.view' },
  { path: '/master/playbooks', element: <MasterAssetPage key="playbooks" type="playbooks" />, permission: 'master_playbooks.view' },
  { path: '/master/sending-profiles', element: <MasterSendingProfiles />, permission: 'master_sending_profiles.view' },
  { path: '/master/email-templates', element: <MasterEmailTemplates />, permission: 'master_email_templates.view' },
  { path: '/master/landing-pages', element: <MasterLandingPages />, permission: 'master_landing_pages.view' },
  { path: '/master/domains', element: <MasterDomains />, permission: 'domains.view' },
  { path: '/admin/users', element: <Users />, permission: 'users.view' },
  { path: '/admin/roles', element: <Roles />, permission: 'users.manage_roles' },
  { path: '/admin/settings', element: <Settings />, permission: 'settings.view' },
  { path: '*', element: <Dashboard /> },
]

export const frontendRoutes = [
  { index: true, element: <Dashboard />, permission: 'dashboard.view' },
  { path: '/dashboard', element: <Dashboard />, permission: 'dashboard.view' },
  { path: '/calendar', element: <Calendar />, permission: 'campaigns.view' },
  { path: '/pre/socialization', element: <Socialization />, permission: 'campaigns.view' },
  { path: '/campaigns', element: <Campaigns />, permission: 'campaigns.view' },
  { path: '/playbooks', element: <Playbooks />, permission: 'playbooks.view' },
  { path: '/monitoring', element: <Performing />, permission: 'campaigns.view' },
  { path: '/sending-profiles', element: <SendingProfiles />, permission: 'sending_profiles.view' },
  { path: '/email-templates', element: <EmailTemplates />, permission: 'email_templates.view' },
  { path: '/landing-pages', element: <LandingPages />, permission: 'landing_pages.view' },
  { path: '/simulation/preparation', element: <Preparation />, permission: 'campaigns.view' },
  { path: '/simulation/performing', element: <Performing />, permission: 'campaigns.view' },
  { path: '/reports', element: <Reports />, permission: 'reports.view' },
  { path: '/reports/:campaignId', element: <Reports />, permission: 'reports.view' },
  { path: '/post/quiz', element: <Quiz />, permission: 'post_sim.view' },
  { path: '/post/coaching', element: <Coaching />, permission: 'post_sim.view' },
  { path: '/next-planning', element: <NextPlanning />, permission: 'post_sim.view' },
  { path: '/setup/playbooks', element: <Playbooks />, permission: 'playbooks.view' },
  { path: '*', element: <Dashboard /> },
]

/**
 * path -> permission key lookup, derived from the route arrays above so the
 * permission is only ever declared once per route. Consumed by the sidebar
 * nav filters (Sidebar.jsx / FrontendLayout.jsx) to hide items the current
 * user can't reach — the actual access control is PermissionRoute (route
 * guard) plus, ultimately, the backend.
 */
function buildRoutePermissionMap(routes) {
  const map = new Map()
  routes.forEach((route) => {
    if (route.path && route.permission) {
      map.set(route.path, route.permission)
    }
  })
  return map
}

export const adminRoutePermissions = buildRoutePermissionMap(adminRoutes)
export const frontendRoutePermissions = buildRoutePermissionMap(frontendRoutes)

/**
 * Filter nav groups down to items whose route requires a permission the
 * current user actually holds (items with no mapped permission always show).
 * Drops any group left with zero items so an empty group heading never renders.
 */
export function filterNavGroupsByPermission(groups, routePermissionMap, permissions) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const required = routePermissionMap.get(item.to)
        return !required || permissions.includes(required)
      }),
    }))
    .filter((group) => group.items.length > 0)
}

export const adminNavGroups = [
  {
    group: 'Overview',
    items: [
      { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { to: '/admin/users', icon: 'ti-users', label: 'User Access' },
      { to: '/admin/roles', icon: 'ti-shield-lock', label: 'Roles' },
      { to: '/admin/settings', icon: 'ti-settings', label: 'Settings' },
    ],
  },
  {
    group: 'Master Library',
    items: [
      { to: '/master/playbooks', icon: 'ti-book', label: 'Playbook' },
      { to: '/master/landing-pages', icon: 'ti-browser', label: 'Landing Page' },
      { to: '/master/email-templates', icon: 'ti-mail', label: 'Email Template' },
      { to: '/master/sending-profiles', icon: 'ti-send', label: 'Sending profiles' },
    ],
  },
  {
    group: 'Master Of Simulation',
    items: [
      { to: '/master/domains', icon: 'ti-world', label: 'Domains' },
    ],
  },
]

export const frontendNavGroups = [
  {
    group: 'Overview',
    items: [
      { to: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard' },
      { to: '/calendar', icon: 'ti-calendar', label: 'Simulation calendar' },
    ],
  },
  {
    group: 'Simulation',
    items: [
      { to: '/campaigns', icon: 'ti-circle-plus', label: 'New campaign' },
      { to: '/playbooks', icon: 'ti-book', label: 'Playbooks' },
      { to: '/monitoring', icon: 'ti-activity', label: 'Monitoring' },
      { to: '/sending-profiles', icon: 'ti-send', label: 'Sending profiles' },
      { to: '/email-templates', icon: 'ti-mail', label: 'Email templates' },
      { to: '/landing-pages', icon: 'ti-browser', label: 'Landing pages' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { to: '/reports', icon: 'ti-chart-bar', label: 'Simulation report', end: false },
    ],
  },
  {
    group: 'Post Sim',
    items: [
      { to: '/post/quiz', icon: 'ti-help-circle', label: 'Quiz' },
      { to: '/post/coaching', icon: 'ti-school', label: 'Coaching' },
      { to: '/next-planning', icon: 'ti-map-2', label: 'Next planning' },
    ],
  },
]

export const routeMeta = [
  { path: '/dashboard', title: 'Dashboard', subtitle: 'Platform overview and key metrics', breadcrumb: 'Dashboard' },
  { path: '/campaigns', title: 'Campaigns', subtitle: 'Manage all phishing simulation campaigns', breadcrumb: 'New campaign' },
  { path: '/calendar', title: 'Simulation calendar', subtitle: '', breadcrumb: 'Simulation calendar' },
  { path: '/monitoring', title: 'Monitoring', subtitle: 'Live campaign activity and risk signals', breadcrumb: 'Monitoring' },
  { path: '/sending-profiles', title: 'Sending profiles', subtitle: 'SMTP relay configuration for GoPhish delivery', breadcrumb: 'Sending profiles' },
  { path: '/email-templates', title: 'Email templates', subtitle: '', breadcrumb: 'Email templates' },
  { path: '/landing-pages', title: 'Landing pages', subtitle: '', breadcrumb: 'Landing pages' },
  { path: '/simulation/preparation', title: 'Preparation', subtitle: 'Import targets and configure templates', breadcrumb: 'Preparation' },
  { path: '/simulation/performing', title: 'Monitoring', subtitle: 'Live campaign activity and risk signals', breadcrumb: 'Monitoring' },
  { path: '/reports', title: 'Reports', subtitle: 'Analytics, risk scores, and exports', breadcrumb: 'Simulation report' },
  { path: '/post/quiz', title: 'Quiz Module', subtitle: 'Question bank and quiz results', breadcrumb: 'Quiz' },
  { path: '/post/coaching', title: 'Coaching', subtitle: 'Training assignments for high-risk users', breadcrumb: 'Coaching' },
  { path: '/next-planning', title: 'Next planning', subtitle: '', breadcrumb: 'Next planning' },
  { path: '/pre/socialization', title: 'Socialization', subtitle: 'Pre-simulation awareness campaigns', breadcrumb: 'Socialization' },
  { path: '/playbooks', title: 'Playbooks', subtitle: 'Reusable campaign templates', breadcrumb: 'Playbooks' },
  { path: '/setup/playbooks', title: 'Playbooks', subtitle: 'Reusable campaign templates', breadcrumb: 'Playbooks' },
  { path: '/master/playbooks', title: 'Master playbooks', subtitle: 'Assigned reusable playbooks', breadcrumb: 'Master playbooks' },
  { path: '/master/sending-profiles', title: 'Master sending profiles', subtitle: 'Assigned SMTP relay profiles', breadcrumb: 'Master sending profiles' },
  { path: '/master/email-templates', title: 'Master email templates', subtitle: 'Assigned GoPhish email templates', breadcrumb: 'Master email templates' },
  { path: '/master/landing-pages', title: 'Master landing pages', subtitle: 'Assigned simulation landing pages', breadcrumb: 'Master landing pages' },
  { path: '/master/domains', title: 'Domain Management', subtitle: 'Lookalike domains for sending and landing pages', breadcrumb: 'Domain Management' },
  { path: '/admin/users', title: 'User Access', subtitle: 'Role-based access control', breadcrumb: 'User Access' },
  { path: '/admin/roles', title: 'Roles', subtitle: 'Create and manage RBAC roles', breadcrumb: 'Roles' },
  { path: '/admin/settings', title: 'Settings', subtitle: 'Global configuration and GoPhish connection', breadcrumb: 'Settings' },
]
