import clsx from 'clsx'
import { DEPARTMENTS, ACTIVITY_FEED } from '../Overview/overviewData.js'
import TimelineCard from './TimelineCard.jsx'

const HOURLY_ACTIVITY = [4, 8, 18, 32, 40, 45, 38, 28, 20, 10]

export default function MonitoringView({ campaigns }) {
  const activeCampaign = campaigns.find(c => c.status === 'active') || campaigns[0]
  const max = Math.max(...HOURLY_ACTIVITY)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Monitoring real-time</h2>
          <p className="text-sm text-gray-500 mt-0.5">Updates automatically every 5 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-red-50 text-red-600 rounded-full px-3 py-1 text-xs font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Live</span>
          </div>
          <select className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:border-violet-500">
            {campaigns.map(campaign => <option key={campaign.id}>{campaign.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Sent', value: '1,118', helper: 'of 1,240 targets', icon: 'ti-send', cls: 'text-gray-500' },
          { label: 'Opened', value: '634', helper: '57% open rate', icon: 'ti-eye', cls: 'text-amber-600' },
          { label: 'Link clicks', value: '201', helper: '18% click rate', icon: 'ti-pointer', cls: 'text-red-600' },
          { label: 'Data submitted', value: '87', helper: '43% of clickers', icon: 'ti-forms', cls: 'text-red-600' },
          { label: 'High-risk', value: '42', helper: 'needs coaching', icon: 'ti-alert-triangle', cls: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <i className={clsx('ti text-sm', card.icon)} />
              <span>{card.label}</span>
            </div>
            <span className="text-2xl font-bold text-gray-900 mt-2 block">{card.value}</span>
            <span className={clsx('text-xs font-semibold mt-1 block', card.cls)}>{card.helper}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Simulation funnel</h3>
            <p className="text-xs text-gray-500 mt-0.5">{activeCampaign?.name}</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Emails sent', value: '1,118', rate: 100, cls: 'bg-violet-100 text-violet-700' },
              { label: 'Emails opened', value: '634', rate: 57, cls: 'bg-amber-200 text-amber-700' },
              { label: 'Link clicks', value: '201', rate: 18, cls: 'bg-red-200 text-red-700' },
              { label: 'Submit form', value: '87', rate: 8, cls: 'bg-red-400 text-white' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 text-xs">
                <span className="min-w-[100px] font-semibold text-gray-600">{row.label}</span>
                <div className="flex-grow bg-gray-100 h-6 rounded overflow-hidden relative">
                  <div className={clsx('absolute inset-y-0 left-0 flex items-center px-3 font-bold transition-all duration-300', row.cls)} style={{ width: `${row.rate}%` }}>
                    {row.value}
                  </div>
                </div>
                <span className="font-bold text-gray-500 w-10 text-right">{row.rate}%</span>
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
                {DEPARTMENTS.map(dept => (
                  <tr key={dept.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{dept.name}</td>
                    <td className="py-2.5 px-4">{dept.targets}</td>
                    <td className="py-2.5 px-4">{dept.clicks}</td>
                    <td className="py-2.5 px-4">
                      <div className={clsx('h-1.5 rounded-full inline-block mr-1', dept.cls)} style={{ width: `${dept.rate}px` }} />
                      <span className={clsx('font-semibold align-middle', dept.text)}>{dept.rate}%</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', dept.badge)}>{dept.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Activity per hour</h3>
            <div className="flex items-end gap-1 h-12 mb-2 select-none">
              {HOURLY_ACTIVITY.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className={clsx('flex-1 rounded-t transition-all duration-300', value === max ? 'bg-red-500' : 'bg-gray-200')}
                  title={`${value} clicks`}
                  style={{ height: `${(value / max) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-semibold px-0.5">
              <span>08:00</span>
              <span>12:00</span>
              <span>17:00</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Live event feed</h3>
              <button className="text-xs font-semibold text-violet-500 hover:text-violet-600">All</button>
            </div>
            <div className="space-y-3.5">
              {ACTIVITY_FEED.map((item, index) => (
                <div key={`${item.title}-${index}`} className={clsx('flex gap-3 text-sm pb-2', index < ACTIVITY_FEED.length - 1 && 'border-b border-gray-50')}>
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', item.color)}>
                    <i className={clsx('ti text-xs', item.icon)} />
                  </div>
                  <div>
                    <p className="text-gray-800 text-xs">
                      <strong className="font-semibold text-gray-900">{item.title}</strong> {item.body}
                      {index < 2 && <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[9px] font-semibold animate-pulse ml-1">NEW</span>}
                    </p>
                    <span className="text-gray-400 text-[10px] block mt-0.5">{item.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TimelineCard />
    </div>
  )
}
