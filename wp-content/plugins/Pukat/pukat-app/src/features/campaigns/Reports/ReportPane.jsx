import clsx from 'clsx'
import toast from 'react-hot-toast'
import MetricCard from '../MetricCard.jsx'
import DepartmentBars from '../Overview/DepartmentBars.jsx'

const REPORT_USERS = [
  { name: 'Budi Santoso', dept: 'Finance', clicked: 'Yes', submit: 'Yes', quiz: 'Failed', score: 91, level: 'High', badge: 'bg-red-100 text-red-700', scoreCls: 'text-red-600' },
  { name: 'Sari Dewi', dept: 'HR', clicked: 'Yes', submit: 'Yes', quiz: 'Passed', score: 78, level: 'High', badge: 'bg-red-100 text-red-700', scoreCls: 'text-red-600' },
  { name: 'Andi Pratama', dept: 'Marketing', clicked: 'Yes', submit: 'No', quiz: 'Passed', score: 54, level: 'Medium', badge: 'bg-amber-100 text-amber-700', scoreCls: 'text-amber-600' },
  { name: 'Rina Wijaya', dept: 'Legal', clicked: 'No', submit: 'No', quiz: 'Passed', score: 12, level: 'Low', badge: 'bg-emerald-100 text-emerald-700', scoreCls: 'text-emerald-600' },
]

export default function ReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Click rate" value="18%" helper="▲ 3% vs previous simulation" helperClass="text-red-600" icon="ti-pointer" />
        <MetricCard label="Submit rate" value="8%" helper="▲ 2% vs previous simulation" helperClass="text-red-600" icon="ti-forms" />
        <MetricCard label="Risk score org." value="64" helper="Medium — needs attention" helperClass="text-amber-600" icon="ti-alert-triangle" />
        <MetricCard label="High-risk users" value="42" helper="▲ 8 from the Q1 simulation" helperClass="text-red-600" icon="ti-users" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <DepartmentBars />
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900">Benchmark vs. previous simulation</h4>
            {[
              { label: 'Q2 (current)', rate: 18, cls: 'bg-red-500', text: 'text-red-600' },
              { label: 'Q1 2025', rate: 15, cls: 'bg-violet-500', text: 'text-violet-500' },
              { label: 'Q4 2024', rate: 22, cls: 'bg-gray-400', text: 'text-gray-500' },
            ].map(row => (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-gray-700">{row.label}</span>
                  <span className={clsx('font-bold', row.text)}>{row.rate}%</span>
                </div>
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', row.cls)} style={{ width: `${row.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Organizational risk score</h3>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full border-2 border-red-500 flex flex-col items-center justify-center flex-shrink-0 select-none">
                <span className="text-2xl font-bold text-red-500 leading-none">64</span>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">/ 100</span>
              </div>
              <div className="flex-grow space-y-2">
                {[
                  ['Click history', '40 points'],
                  ['Quiz score', '15 points'],
                  ['Submit form', '9 points'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs border-b border-gray-50 pb-1.5 last:border-b-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <i className="ti ti-bulb text-lg" />
              <h3 className="text-sm font-semibold text-gray-900">Recommendation</h3>
            </div>
            {[
              ['Coaching focus — Finance & HR', '52% of Finance and 40% of HR clicked. Send the BEC awareness module immediately.'],
              ['42 users need mandatory coaching', "Assign the Recognize BEC module to all high-risk users within 48 hours."],
              ['Schedule the next simulation', 'Reduce click rate to <12% in Q3.'],
            ].map(([title, body]) => (
              <div key={title} className="bg-gray-50 rounded-lg p-3 text-xs">
                <h4 className="font-bold text-gray-900">{title}</h4>
                <p className="text-gray-500 mt-1">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Risk score per user</h3>
          <button onClick={() => toast.success('Risk score CSV export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-gray-700">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Click</th>
                <th className="py-2.5 px-4">Submit</th>
                <th className="py-2.5 px-4">Quiz</th>
                <th className="py-2.5 px-4">Risk score</th>
                <th className="py-2.5 px-4">Level</th>
              </tr>
            </thead>
            <tbody>
              {REPORT_USERS.map(user => (
                <tr key={user.name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="py-2.5 px-4 font-semibold text-gray-900">{user.name}</td>
                  <td className="py-2.5 px-4">{user.dept}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', user.clicked === 'Yes' ? 'text-red-600' : 'text-emerald-600')}>{user.clicked}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', user.submit === 'Yes' ? 'text-red-600' : 'text-emerald-600')}>{user.submit}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', user.quiz === 'Failed' ? 'text-red-600' : 'text-emerald-600')}>{user.quiz}</td>
                  <td className={clsx('py-2.5 px-4 font-bold', user.scoreCls)}>{user.score}</td>
                  <td className="py-2.5 px-4">
                    <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', user.badge)}>{user.level}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
