import clsx from 'clsx'

export default function PageHeader({ title, subtitle, actions, spacing = true, className }) {
  return (
    <div className={clsx('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', spacing && 'mb-6', className)}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
