import clsx from 'clsx'
import toast from 'react-hot-toast'

const STATS = [
  { label: 'Sent', value: '1,240', sub: 'of 1,240 targets', icon: 'ti-send', subCls: 'text-gray-500' },
  { label: 'Opened', value: '755', sub: '61% open rate', icon: 'ti-eye', subCls: 'text-amber-600' },
  { label: 'Link clicks', value: '252', sub: '20% click rate', icon: 'ti-pointer', subCls: 'text-red-600' },
  { label: 'Data submitted', value: '119', sub: '47% of clickers', icon: 'ti-forms', subCls: 'text-red-600' },
  { label: 'High-risk', value: '65', sub: 'needs coaching', icon: 'ti-alert-triangle', subCls: 'text-red-600' },
]

const FUNNEL = [
  { label: 'Emails sent', value: '1,118', pct: 100, cls: 'bg-violet-100 text-violet-700' },
  { label: 'Emails opened', value: '634', pct: 57, cls: 'bg-amber-200 text-amber-700' },
  { label: 'Link clicks', value: '252', pct: 20, cls: 'bg-red-200 text-red-700' },
  { label: 'Submit form', value: '119', pct: 10, cls: 'bg-red-400 text-white' },
]

const DEPARTMENTS = [
  { dept: 'Finance', targets: 240, click: 124, rate: 52, risk: 'High', bar: 'bg-red-500', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
  { dept: 'HR', targets: 180, click: 72, rate: 40, risk: 'Med', bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { dept: 'Marketing', targets: 320, click: 78, rate: 24, risk: 'Med', bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
  { dept: 'Engineering', targets: 280, click: 18, rate: 6, risk: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  { dept: 'Legal', targets: 220, click: 9, rate: 4, risk: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
]

const HOURLY = [4, 8, 18, 32, 40, 45, 38, 28, 20, 10]

const LIVE_EVENTS = [
  { icon: 'ti-pointer', tone: 'bg-red-100 text-red-600', name: 'Hendra Wijaya', event: 'Clicked phishing link — Marketing', time: 'just now', fresh: true },
  { icon: 'ti-pointer', tone: 'bg-red-100 text-red-600', name: 'Indah Permata', event: 'Clicked phishing link — Marketing', time: 'just now' },
  { icon: 'ti-pointer', tone: 'bg-red-100 text-red-600', name: 'Raka Firmansyah', event: 'Clicked phishing link — Finance', time: 'just now' },
  { icon: 'ti-forms', tone: 'bg-red-100 text-red-600', name: 'Indah Permata', event: 'Submit form — credential harvested', time: 'just now' },
]

const TIMELINE = [
  { time: '16:18', color: 'bg-violet-500', title: 'System — Batch email', meta: 'All · Batch email sent — 122 targets' },
  { time: '14:32', color: 'bg-red-500', title: 'Budi Santoso — Submit form', meta: 'Finance · credential harvested' },
  { time: '14:31', color: 'bg-red-500', title: 'Sari Dewi — Link clicks', meta: 'HR · landing page visited' },
  { time: '14:29', color: 'bg-emerald-500', title: 'Rina Wijaya — Quiz completed', meta: 'Legal · passed 80%' },
  { time: '14:25', color: 'bg-amber-500', title: 'Andi Pratama — Email opened', meta: 'Marketing · has not clicked' },
  { time: '14:18', color: 'bg-red-500', title: 'Dewi Rahayu — Link clicks', meta: 'Finance · landing page visited' },
  { time: '14:10', color: 'bg-amber-500', title: 'Putri Ayu — Email opened', meta: 'HR · has not clicked' },
  { time: '13:55', color: 'bg-red-500', title: 'Raka Firmansyah — Submit form', meta: 'Finance · credential harvested' },
]

export default function Performing() {
  const maxHourly = Math.max(...HOURLY)

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring real-time</h1>
          <p className="text-sm text-gray-500 mt-0.5">Updates automatically every 5 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1 text-xs font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Live</span>
          </div>
          <select className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-violet-500">
            <option>Q2 Phishing Wave — Finance</option>
            <option>BEC Scenario — Finance</option>
            <option>Q1 Awareness Check</option>
          </select>
          <button onClick={() => toast.success('CSV export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATS.map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <i className={clsx('ti text-sm', stat.icon)} />
              <span>{stat.label}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</span>
            <span className={clsx('text-xs font-semibold mt-1', stat.subCls)}>{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-6">
          <h3 className="text-base font-semibold text-gray-900">Simulation funnel</h3>
          <div className="space-y-3">
            {FUNNEL.map(row => (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <span className="min-w-[100px] font-semibold text-gray-600">{row.label}</span>
                <div className="flex-grow bg-gray-100 h-6 rounded overflow-hidden relative">
                  <div className={clsx('absolute inset-y-0 left-0 flex items-center px-3 font-bold transition-all duration-300', row.cls)} style={{ width: `${row.pct}%` }}>
                    {row.value}
                  </div>
                </div>
                <span className="font-bold text-gray-500 w-10 text-right">{row.pct}%</span>
              </div>
            ))}
          </div>

          <hr className="border-gray-100" />

          <h3 className="text-base font-semibold text-gray-900">By department</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-4">Dept</th>
                  <th className="py-2 px-4">Target</th>
                  <th className="py-2 px-4">Click</th>
                  <th className="py-2 px-4">Rate</th>
                  <th className="py-2 px-4">Risk</th>
                </tr>
              </thead>
              <tbody>
                {DEPARTMENTS.map(row => (
                  <tr key={row.dept} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{row.dept}</td>
                    <td className="py-2.5 px-4">{row.targets}</td>
                    <td className="py-2.5 px-4">{row.click}</td>
                    <td className="py-2.5 px-4">
                      <div className={clsx('h-1.5 rounded-full inline-block mr-1', row.bar)} style={{ width: `${row.rate}px` }} />
                      <span className={clsx('font-semibold align-middle', row.text)}>{row.rate}%</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', row.badge)}>{row.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6 flex flex-col">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity per hour</h3>
            <div className="flex items-end gap-1 h-12 mb-2 select-none">
              {HOURLY.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className={clsx('flex-1 rounded-t transition-all duration-300', value === maxHourly ? 'bg-red-500' : 'bg-gray-200')}
                  title={`${value} clicks`}
                  style={{ height: `${(value / maxHourly) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-semibold px-0.5">
              <span>08:00</span>
              <span>12:00</span>
              <span>17:00</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 flex-grow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Live event feed</h3>
              <button className="text-xs font-semibold text-violet-500 hover:text-violet-600">All</button>
            </div>
            <div className="space-y-3.5">
              {LIVE_EVENTS.map((event, index) => (
                <div key={`${event.name}-${index}`} className={clsx('flex gap-3 text-sm pb-2', index < LIVE_EVENTS.length - 1 && 'border-b border-gray-50')}>
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', event.tone)}>
                    <i className={clsx('ti text-xs', event.icon)} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-xs">
                      <strong className="font-semibold text-gray-900">{event.name}</strong>
                      {event.fresh && <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[9px] font-semibold animate-pulse ml-1">NEW</span>}
                      {' '}{event.event}
                    </p>
                    <span className="text-gray-400 text-[10px] block mt-0.5">{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
          <h3 className="text-sm font-semibold text-gray-900">Today&apos;s event timeline</h3>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {['All', 'Click', 'Submit', 'Open'].map((filter, index) => (
                <button key={filter} type="button" className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', index === 0 ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  {filter}
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
              {TIMELINE.filter((_, index) => index % 2 === column).map(event => (
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
    </div>
  )
}
