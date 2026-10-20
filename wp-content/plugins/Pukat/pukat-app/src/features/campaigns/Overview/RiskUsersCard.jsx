import clsx from 'clsx'
import { RISK_USERS } from './overviewData.js'

export default function RiskUsersCard() {
  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <h3 className="text-base font-semibold text-ink mb-4">High-risk users</h3>
      <div className="space-y-4">
        {RISK_USERS.map(user => (
          <div key={user.name} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={clsx('w-8 h-8 rounded-full font-semibold text-xs flex items-center justify-center select-none flex-shrink-0', user.avatar)}>
                {user.initials}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-ink truncate">{user.name}</h4>
                <span className="text-xs text-ink-muted">{user.dept}</span>
              </div>
            </div>
            <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 flex-shrink-0', user.badge)}>{user.level}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
