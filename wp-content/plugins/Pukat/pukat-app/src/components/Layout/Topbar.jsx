import clsx from 'clsx'
import Breadcrumbs from '../UI/Breadcrumbs.jsx'
import ThemeToggle from '../UI/ThemeToggle.jsx'
import UserMenu from './UserMenu.jsx'

export default function Topbar({ groupLabel, activeLabel, className }) {
  const breadcrumbItems = groupLabel
    ? [{ label: groupLabel }, { label: activeLabel }]
    : [{ label: activeLabel }]

  return (
    <header className={clsx('h-14 z-20 flex flex-shrink-0 items-center justify-between border-b border-line bg-panel px-6', className)}>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
