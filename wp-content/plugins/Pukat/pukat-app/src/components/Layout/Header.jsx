import { useLocation } from 'react-router-dom'
import { getRouteMeta } from '../../config/routeMeta.js'
import { adminNavGroups, getActiveGroupLabel } from '../../config/appRoutes.jsx'
import Topbar from './Topbar.jsx'

export default function Header() {
  const { pathname } = useLocation()
  const { breadcrumb } = getRouteMeta(pathname, { breadcrumb: 'Dashboard' })
  const groupLabel = getActiveGroupLabel(pathname, adminNavGroups)

  return <Topbar groupLabel={groupLabel} activeLabel={breadcrumb} className="sticky top-0" />
}
