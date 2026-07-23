import clsx from 'clsx'

export default function EmptyState({ icon = 'ti-inbox', title = 'No data', description, action, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 py-10 text-center', className)}>
      <i className={clsx('ti text-3xl text-gray-300', icon)} />
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {description && <p className="text-xs text-gray-400">{description}</p>}
      {action}
    </div>
  )
}
