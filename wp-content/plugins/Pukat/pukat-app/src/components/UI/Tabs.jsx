import clsx from 'clsx'

export default function Tabs({ items, active, onChange, variant = 'underline', ariaLabel, className }) {
  if (variant === 'pill') {
    return (
      <div className={clsx('inline-flex gap-1 rounded-full bg-panel-muted p-1', className)}>
        {items.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
              active === item.key ? 'bg-panel text-violet-600 dark:text-violet-400 shadow-sm' : 'text-ink-muted hover:text-ink-soft'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={clsx('overflow-x-auto border-b border-line no-scrollbar', className)}>
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
                : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink-soft'
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
