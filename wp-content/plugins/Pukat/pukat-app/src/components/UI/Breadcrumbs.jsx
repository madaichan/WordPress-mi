import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

/**
 * items: [{ label, to? }] — the last item is always rendered as the current
 * (non-link) crumb, regardless of whether it has a `to`.
 */
export default function Breadcrumbs({ items, className }) {
  return (
    <div className={clsx('flex items-center gap-2 text-sm font-medium text-ink-muted', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={item.label} className="flex items-center gap-2">
            {index > 0 && <span className="text-ink-faint">/</span>}
            {item.to && !isLast ? (
              <NavLink to={item.to} className="hover:text-ink">{item.label}</NavLink>
            ) : (
              <span className={clsx(isLast && 'font-semibold text-ink')}>{item.label}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}
