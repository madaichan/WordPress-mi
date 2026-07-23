import clsx from 'clsx'

const DOT_CLASS = {
  violet: 'bg-violet-500',
  success: 'bg-green-500',
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  gray: 'bg-gray-400',
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

export default function Badge({ tone = 'gray', dot, className, children }) {
  return (
    <span className={clsx(`badge-${tone}`, className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOT_CLASS[tone])} />}
      {children}
    </span>
  )
}
