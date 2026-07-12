import clsx from 'clsx'

const variantClass = {
  primary: 'bg-violet-500 text-white hover:bg-violet-600 focus:ring-violet-400 active:scale-95',
  secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300 active:scale-95',
  danger: 'bg-danger/10 text-danger hover:bg-danger hover:text-white focus:ring-danger/40 active:scale-95',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 focus:ring-gray-200',
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
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400/40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
