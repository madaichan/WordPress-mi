import { routeMeta } from './appRoutes.jsx'

export const ROUTE_META = routeMeta

/**
 * Finds the best-matching route metadata for a pathname via prefix match.
 *
 * @param {string} pathname - Current router pathname (e.g. from useLocation()).
 * @param {{ title?: string, subtitle?: string, breadcrumb?: string }} [fallback] - Returned when no route matches.
 */
export function getRouteMeta(pathname, fallback = {}) {
  const match = ROUTE_META.find(({ path }) => pathname.startsWith(path))
  return match ?? fallback
}
