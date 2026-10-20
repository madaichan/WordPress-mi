import clsx from 'clsx'

export default function MetricCard({ label, value, helper, icon, helperClass = 'text-ink-muted' }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 flex items-start justify-between">
      <div className="space-y-1 min-w-0">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="block text-2xl font-bold text-ink">{value}</span>
        <span className={clsx('block text-xs font-semibold', helperClass)}>{helper}</span>
      </div>
      <div className="w-9 h-9 bg-panel-subtle rounded-lg flex items-center justify-center text-ink-faint flex-shrink-0">
        <i className={clsx('ti text-lg', icon)} />
      </div>
    </div>
  )
}
