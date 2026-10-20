import clsx from 'clsx'
import { Link } from 'react-router-dom'

const toneClass = {
  violet: 'hover:border-violet-500 hover:text-violet-500 hover:bg-violet-500/10',
  blue: 'hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10',
  green: 'hover:border-green-600 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-500/10',
  amber: 'hover:border-amber-600 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10',
  red: 'hover:border-red-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10',
}

const sizeClass = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
}

export default function TableActionButton({
  icon,
  label,
  title = label,
  tone = 'violet',
  size = 'sm',
  framed = true,
  to,
  onClick,
  disabled = false,
  className,
}) {
  const classes = clsx(
    'inline-flex items-center justify-center rounded-lg text-ink-muted transition-all focus:outline-none focus:ring-2 focus:ring-violet-400/40',
    sizeClass[size],
    framed ? 'border border-line bg-panel' : 'border border-transparent bg-transparent',
    disabled && 'cursor-not-allowed opacity-50',
    !disabled && toneClass[tone],
    className
  )

  const content = <i className={clsx('ti text-xs', icon, size === 'md' && 'text-sm')} />

  if (to) {
    return (
      <Link to={to} className={classes} title={title} aria-label={label}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes} title={title} aria-label={label}>
      {content}
    </button>
  )
}
