import clsx from 'clsx'

/** Small icon-button switch (e.g. grid vs table) — value/onChange over a list of {value, icon, label}. */
export default function ViewToggle({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-panel-subtle p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.label}
          className={clsx(
            'flex items-center justify-center rounded-md p-1.5 transition-all',
            value === option.value ? 'bg-panel text-violet-600 dark:text-violet-400 shadow-sm' : 'text-ink-faint hover:text-ink-muted',
          )}
        >
          <i className={clsx('ti text-sm', option.icon)} />
        </button>
      ))}
    </div>
  )
}
