import clsx from 'clsx'

export default function Switch({ checked, onChange, label, disabled, className }) {
  return (
    <label
      className={clsx(
        'inline-flex items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer select-none',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={clsx(
          'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400/40',
          disabled ? 'bg-panel-strong' : checked ? 'bg-violet-500' : 'bg-panel-strong'
        )}
      >
        <span
          className={clsx(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-panel shadow transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          )}
        />
      </button>
      {label && <span className="text-sm text-ink-soft">{label}</span>}
    </label>
  )
}
