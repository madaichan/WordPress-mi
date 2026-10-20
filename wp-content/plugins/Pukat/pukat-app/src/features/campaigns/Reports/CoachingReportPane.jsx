import clsx from 'clsx'
import toast from 'react-hot-toast'
import MetricCard from '../MetricCard.jsx'

export default function CoachingReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="High-risk assigned" value="42" helper="100% already assigned modules" helperClass="text-emerald-600 dark:text-emerald-400" icon="ti-school" />
        <MetricCard label="Completed coaching" value="18" helper="43% completion" icon="ti-circle-check" />
        <MetricCard label="Active drip campaigns" value="3" helper="Weekly tips running" icon="ti-mail" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Progress by user</h3>
            <button onClick={() => toast.success('Escalation notification sent to department managers.')} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Notif. manager
            </button>
          </div>
          {[
            ['BS', 'Budi Santoso', 'Finance · Module: Recognize BEC', 20, 'text-amber-600 dark:text-amber-400', 'bg-red-500/15 text-red-600 dark:text-red-400'],
            ['SD', 'Sari Dewi', 'HR · Module: Recognize BEC + Social Engineering', 60, 'text-blue-600 dark:text-blue-400', 'bg-red-500/15 text-red-600 dark:text-red-400'],
            ['AP', 'Andi Pratama', 'Marketing · Module: Phishing 101', 100, 'text-emerald-600 dark:text-emerald-400', 'bg-amber-500/15 text-amber-700 dark:text-amber-300'],
          ].map(([initials, name, meta, progress, textCls, avatar]) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <div className={clsx('w-8 h-8 rounded-full font-semibold flex items-center justify-center flex-shrink-0 select-none', avatar)}>{initials}</div>
              <div className="flex-grow">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-ink">{name}</span>
                  <span className={clsx('font-semibold', textCls)}>{progress === 100 ? 'Completed' : `${progress}%`}</span>
                </div>
                <p className="text-ink-faint text-[10px] mt-0.5">{meta}</p>
                <div className="w-full bg-panel-strong h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className={clsx('h-1.5 rounded-full', progress === 100 ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Active drip campaigns</h3>
            <button onClick={() => toast.success('Opening the new drip campaign dialog.')} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Create new
            </button>
          </div>
          {[
            ['Weekly Security Tips', 'Every Monday · 42 recipients', 'Open rate: 68%'],
            ['BEC Awareness Drip', '3x weekly · Finance & HR · 24 recipients', 'Open rate: 74%'],
          ].map(([title, meta, rate]) => (
            <div key={title} className="border border-line rounded-xl p-4 bg-panel space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-ink">{title}</h4>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Active</span>
              </div>
              <p className="text-ink-faint text-[10px]">{meta}</p>
              <p className="text-ink-soft font-medium text-[10px] pt-1">{rate}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
