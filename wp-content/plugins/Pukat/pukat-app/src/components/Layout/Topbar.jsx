import clsx from 'clsx'
import Breadcrumbs from '../UI/Breadcrumbs.jsx'
import UserMenu from './UserMenu.jsx'

export default function Topbar({ groupLabel, activeLabel, className }) {
  const breadcrumbItems = groupLabel
    ? [{ label: groupLabel }, { label: activeLabel }]
    : [{ label: activeLabel }]

  return (
    <header className={clsx('h-14 z-20 flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6', className)}>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex items-center gap-4">
        <UserMenu />
      </div>
    </header>
  )
}
