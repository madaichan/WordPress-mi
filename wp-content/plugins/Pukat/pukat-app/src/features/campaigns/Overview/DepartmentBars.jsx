import clsx from 'clsx'
import { DEPARTMENTS } from './overviewData.js'

export default function DepartmentBars({ title = 'Click rate by department' }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-3">
      <h3 className="text-base font-semibold text-ink mb-4">{title}</h3>
      <div className="space-y-4">
        {DEPARTMENTS.map(dept => (
          <div key={dept.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-ink-soft">{dept.name}</span>
              <span className={clsx('font-bold', dept.text)}>{dept.rate}%</span>
            </div>
            <div className="w-full bg-panel-muted h-2 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full', dept.cls)} style={{ width: `${dept.rate}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
