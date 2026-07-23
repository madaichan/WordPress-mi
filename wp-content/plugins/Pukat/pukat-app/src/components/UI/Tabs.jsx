import clsx from 'clsx'

export default function Tabs({ items, active, onChange, variant = 'underline', ariaLabel, className }) {
  if (variant === 'pill') {
    return (
      <div className={clsx('inline-flex gap-1 rounded-full bg-gray-100 p-1', className)}>
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
              active === item.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={clsx('overflow-x-auto border-b border-gray-200 no-scrollbar', className)}>
      <nav className="flex min-w-max gap-5" aria-label={ariaLabel}>
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              'flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-semibold transition-all focus:outline-none',
              active === item.key
                ? 'border-violet-500 text-violet-500'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            )}
          >
            {item.icon && <i className={clsx('ti text-base', item.icon)} />}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
