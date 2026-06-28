import { Link } from 'react-router-dom'
import clsx from 'clsx'

const DAYS = [
  26, 27, 28, 29, 30, 31, 1,
  2, 3, 4, 5, 6, 7, 8,
  9, 10, 11, 12, 13, 14, 15,
  16, 17, 18, 19, 20, 21, 22,
  23, 24, 25, 26, 27, 28, 29,
  30, 1, 2, 3, 4, 5, 6,
]

export default function Calendar() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Simulation calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Phishing simulation delivery schedule — June 2025</p>
        </div>
        <Link to="/campaigns" className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl inline-flex items-center gap-1.5 transition-all">
          <i className="ti ti-circle-plus" />
          New campaign
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 mb-3">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2 min-h-96">
          {DAYS.map((day, index) => {
            const muted = index < 6 || index > 34
            const q2 = index >= 23 && index <= 30
            const bec = index === 33
            return (
              <div
                key={`${day}-${index}`}
                className={clsx(
                  'border rounded-lg p-2 text-xs font-medium relative min-h-14',
                  muted && 'border-gray-100 text-gray-400 bg-gray-50',
                  !muted && !q2 && !bec && 'border-gray-200 text-gray-700 bg-white',
                  q2 && 'border-blue-200 bg-blue-50/50 text-blue-900',
                  bec && 'border-gray-200 bg-gray-50/50 text-gray-800',
                )}
              >
                {day}
                {q2 && <div className="absolute bottom-1 left-1 right-1 bg-blue-100 text-blue-700 text-[9px] px-1 rounded truncate font-semibold">Q2 phishing</div>}
                {bec && <div className="absolute bottom-1 left-1 right-1 bg-gray-100 text-gray-600 text-[9px] px-1 rounded truncate font-semibold">BEC scenario</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
