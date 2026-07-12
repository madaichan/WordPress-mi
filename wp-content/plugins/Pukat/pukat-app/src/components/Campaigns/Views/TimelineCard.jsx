import clsx from 'clsx'
import toast from 'react-hot-toast'

const TIMELINE_EVENTS = [
  { time: '14:32', color: 'bg-red-500', title: 'Budi Santoso — Submit form', meta: 'Finance · credential harvested' },
  { time: '14:31', color: 'bg-red-500', title: 'Sari Dewi — Link clicks', meta: 'HR · landing page visited' },
  { time: '14:29', color: 'bg-emerald-500', title: 'Rina Wijaya — Quiz completed', meta: 'Legal · passed 80%' },
  { time: '14:25', color: 'bg-amber-500', title: 'Andi Pratama — Email opened', meta: 'Marketing · has not clicked' },
  { time: '14:18', color: 'bg-red-500', title: 'Dewi Rahayu — Link clicks', meta: 'Finance · landing page visited' },
  { time: '14:10', color: 'bg-amber-500', title: 'Putri Ayu — Email opened', meta: 'HR · has not clicked' },
  { time: '13:55', color: 'bg-red-500', title: 'Raka Firmansyah — Submit form', meta: 'Finance · credential harvested' },
  { time: '13:40', color: 'bg-violet-500', title: 'Batch email batch 3 sent', meta: '420 email · Finance & HR' },
]

export default function TimelineCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
        <h3 className="text-sm font-semibold text-gray-900">Today&apos;s event timeline</h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {['All', 'Click', 'Submit', 'Open'].map((label, index) => (
              <button key={label} className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', index === 0 ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => toast.success('Log export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1 text-xs font-semibold rounded-lg transition-all">
            Export Log
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {[0, 1].map(column => (
          <div key={column} className="space-y-4">
            {TIMELINE_EVENTS.filter((_, index) => index % 2 === column).map(event => (
              <div key={`${event.time}-${event.title}`} className="flex gap-3">
                <span className="w-10 text-right text-gray-400 text-[11px] mt-0.5 flex-shrink-0">{event.time}</span>
                <div className="flex flex-col items-center flex-shrink-0 mt-1">
                  <span className={clsx('w-[9px] h-[9px] rounded-full flex-shrink-0', event.color)} />
                  <div className="w-px bg-gray-200 flex-grow h-10 mt-1" />
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-900">{event.title}</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">{event.meta}</p>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
