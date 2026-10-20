import clsx from 'clsx'

const variantClass = {
  primary: 'bg-violet-500 text-white hover:bg-violet-600 focus:ring-violet-400 active:scale-95',
  secondary: 'bg-panel-muted text-ink-soft hover:bg-panel-strong focus:ring-line-strong active:scale-95',
  outline: 'border border-line bg-panel text-ink-soft hover:bg-panel-subtle focus:ring-line-strong active:scale-95',
  danger: 'bg-danger/10 text-danger hover:bg-danger hover:text-white focus:ring-danger/40 active:scale-95',
  ghost: 'bg-transparent text-ink-muted hover:bg-panel-muted focus:ring-line',
}

const sizeClass = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  type = 'button',
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border-0 font-medium outline-none transition-all duration-150 focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  title = label,
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-subtle hover:text-ink-soft focus:outline-none focus:ring-2 focus:ring-violet-400/40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
