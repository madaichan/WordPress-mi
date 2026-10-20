import clsx from 'clsx'

const DOT_CLASS = {
  violet: 'bg-violet-500',
  success: 'bg-green-500',
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  gray: 'bg-ink-faint',
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

// Written out in full, not built as `badge-${tone}`: Tailwind only keeps
// classes it finds literally in the source, so dynamic names were purged
// from the build (success/danger badges rendered as plain text).
const TONE_CLASS = {
  violet: 'badge-violet',
  success: 'badge-success',
  danger: 'badge-danger',
  warning: 'badge-warning',
  info: 'badge-info',
  gray: 'badge-gray',
  low: 'badge-low',
  medium: 'badge-medium',
  high: 'badge-high',
  critical: 'badge-critical',
}

export default function Badge({ tone = 'gray', dot, className, children }) {
  return (
    <span className={clsx(TONE_CLASS[tone] || TONE_CLASS.gray, className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOT_CLASS[tone])} />}
      {children}
    </span>
  )
}
