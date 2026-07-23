import clsx from 'clsx'
import Breadcrumbs from '../UI/Breadcrumbs.jsx'

export default function Topbar({ activeLabel, className }) {
  return (
    <header className={clsx('h-14 z-20 flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6', className)}>
      <Breadcrumbs items={[{ label: 'Flow beyond', to: '/dashboard' }, { label: activeLabel }]} />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <span>WordPress plugin</span>
        </div>
        <div className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
          WP
        </div>
      </div>
    </header>
  )
}
