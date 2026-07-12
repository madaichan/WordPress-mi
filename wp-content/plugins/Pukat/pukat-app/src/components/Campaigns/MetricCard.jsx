import clsx from 'clsx'

export default function MetricCard({ label, value, helper, icon, helperClass = 'text-gray-500' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between">
      <div className="space-y-1 min-w-0">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="block text-2xl font-bold text-gray-900">{value}</span>
        <span className={clsx('block text-xs font-semibold', helperClass)}>{helper}</span>
      </div>
      <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400 flex-shrink-0">
        <i className={clsx('ti text-lg', icon)} />
      </div>
    </div>
  )
}
