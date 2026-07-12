import clsx from 'clsx'
import { Link } from 'react-router-dom'

const toneClass = {
  violet: 'hover:border-violet-500 hover:text-violet-500 hover:bg-violet-50',
  blue: 'hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50',
  green: 'hover:border-green-600 hover:text-green-600 hover:bg-green-50',
  amber: 'hover:border-amber-600 hover:text-amber-600 hover:bg-amber-50',
  red: 'hover:border-red-600 hover:text-red-600 hover:bg-red-50',
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
  className,
}) {
  const classes = clsx(
    'inline-flex items-center justify-center rounded-lg text-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-violet-400/40',
    sizeClass[size],
    framed ? 'border border-gray-200 bg-white' : 'border border-transparent bg-transparent',
    toneClass[tone],
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
    <button type="button" onClick={onClick} className={classes} title={title} aria-label={label}>
      {content}
    </button>
  )
}
