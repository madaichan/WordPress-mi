import { useLocation } from 'react-router-dom'
import { getRouteMeta } from '../../config/routeMeta.js'
import Topbar from './Topbar.jsx'

export default function Header() {
  const { pathname } = useLocation()
  const { breadcrumb } = getRouteMeta(pathname, { breadcrumb: 'Dashboard' })

  return <Topbar activeLabel={breadcrumb} className="sticky top-0" />
}
