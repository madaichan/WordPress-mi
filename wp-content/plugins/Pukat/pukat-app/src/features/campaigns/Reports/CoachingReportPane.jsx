import clsx from 'clsx'
import toast from 'react-hot-toast'
import MetricCard from '../MetricCard.jsx'

export default function CoachingReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="High-risk assigned" value="42" helper="100% already assigned modules" helperClass="text-emerald-600" icon="ti-school" />
        <MetricCard label="Completed coaching" value="18" helper="43% completion" icon="ti-circle-check" />
        <MetricCard label="Active drip campaigns" value="3" helper="Weekly tips running" icon="ti-mail" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Progress by user</h3>
            <button onClick={() => toast.success('Escalation notification sent to department managers.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Notif. manager
            </button>
          </div>
          {[
            ['BS', 'Budi Santoso', 'Finance · Module: Recognize BEC', 20, 'text-amber-600', 'bg-red-100 text-red-600'],
            ['SD', 'Sari Dewi', 'HR · Module: Recognize BEC + Social Engineering', 60, 'text-blue-600', 'bg-red-100 text-red-600'],
            ['AP', 'Andi Pratama', 'Marketing · Module: Phishing 101', 100, 'text-emerald-600', 'bg-amber-100 text-amber-700'],
          ].map(([initials, name, meta, progress, textCls, avatar]) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <div className={clsx('w-8 h-8 rounded-full font-semibold flex items-center justify-center flex-shrink-0 select-none', avatar)}>{initials}</div>
              <div className="flex-grow">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-gray-900">{name}</span>
                  <span className={clsx('font-semibold', textCls)}>{progress === 100 ? 'Completed' : `${progress}%`}</span>
                </div>
                <p className="text-gray-400 text-[10px] mt-0.5">{meta}</p>
                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className={clsx('h-1.5 rounded-full', progress === 100 ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Active drip campaigns</h3>
            <button onClick={() => toast.success('Opening the new drip campaign dialog.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Create new
            </button>
          </div>
          {[
            ['Weekly Security Tips', 'Every Monday · 42 recipients', 'Open rate: 68%'],
            ['BEC Awareness Drip', '3x weekly · Finance & HR · 24 recipients', 'Open rate: 74%'],
          ].map(([title, meta, rate]) => (
            <div key={title} className="border border-gray-200 rounded-xl p-4 bg-white space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-gray-900">{title}</h4>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700">Active</span>
              </div>
              <p className="text-gray-400 text-[10px]">{meta}</p>
              <p className="text-gray-700 font-medium text-[10px] pt-1">{rate}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
