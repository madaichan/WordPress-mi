import clsx from 'clsx'

const WORKSPACE_VIEWS = [
  { key: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' },
  { key: 'calendar', label: 'Calendar', icon: 'ti-calendar' },
  { key: 'monitoring', label: 'Monitoring', icon: 'ti-activity' },
  { key: 'report', label: 'Report', icon: 'ti-file-analytics' },
  { key: 'assets', label: 'Assets', icon: 'ti-template' },
]

export default function WorkspaceTabs({ active, onChange }) {
  return (
    <div className="border-b border-gray-200 overflow-x-auto no-scrollbar">
      <nav className="flex gap-5 min-w-max" aria-label="Campaign workspace">
        {WORKSPACE_VIEWS.map(item => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={clsx(
              'flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none',
              active === item.key
                ? 'border-violet-500 text-violet-500'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            <i className={clsx('ti text-base', item.icon)} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
