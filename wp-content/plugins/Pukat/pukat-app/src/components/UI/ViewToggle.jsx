import clsx from 'clsx'

/** Small icon-button switch (e.g. grid vs table) — value/onChange over a list of {value, icon, label}. */
export default function ViewToggle({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.label}
          className={clsx(
            'flex items-center justify-center rounded-md p-1.5 transition-all',
            value === option.value ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <i className={clsx('ti text-sm', option.icon)} />
        </button>
      ))}
    </div>
  )
}
