/**
 * overviewData.js
 *
 * Static demo/reference data shared by the Overview cards (DepartmentBars,
 * ActivityFeedCard, RiskUsersCard) AND the Monitoring view's inline
 * department table / live event feed in Campaigns.jsx. Kept centralized
 * here rather than duplicated, since both places must show the same data.
 */

export const DEPARTMENTS = [
  { name: 'Finance', targets: 240, clicks: 124, rate: 52, risk: 'High', cls: 'bg-red-500', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  { name: 'HR', targets: 180, clicks: 72, rate: 40, risk: 'Med', cls: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { name: 'Marketing', targets: 320, clicks: 78, rate: 24, risk: 'Med', cls: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  { name: 'Engineering', targets: 280, clicks: 18, rate: 6, risk: 'Low', cls: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  { name: 'Legal', targets: 220, clicks: 9, rate: 4, risk: 'Low', cls: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
]

export const ACTIVITY_FEED = [
  { icon: 'ti-forms', color: 'bg-red-500/15 text-red-600 dark:text-red-400', title: 'Budi Santoso', body: 'submit form phishing', meta: 'Finance · 2 minutes ago' },
  { icon: 'ti-pointer', color: 'bg-red-500/15 text-red-600 dark:text-red-400', title: 'Sari Dewi', body: 'menglink click phishing', meta: 'HR · 14 minutes ago' },
  { icon: 'ti-check', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', title: '38 user', body: 'completed the simulation quiz', meta: '1 hour ago' },
  { icon: 'ti-school', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', body: 'were assigned coaching modules', title: '42 user', meta: '3 hours ago' },
]

export const RISK_USERS = [
  { initials: 'BS', name: 'Budi Santoso', dept: 'Finance', level: 'High', badge: 'bg-red-500/15 text-red-700 dark:text-red-300', avatar: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { initials: 'SD', name: 'Sari Dewi', dept: 'HR', level: 'High', badge: 'bg-red-500/15 text-red-700 dark:text-red-300', avatar: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  { initials: 'AP', name: 'Andi Pratama', dept: 'Marketing', level: 'Medium', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', avatar: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { initials: 'RW', name: 'Rina Wijaya', dept: 'Legal', level: 'Low', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', avatar: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
]
