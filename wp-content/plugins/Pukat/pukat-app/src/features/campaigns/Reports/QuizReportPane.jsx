import clsx from 'clsx'
import toast from 'react-hot-toast'
import MetricCard from '../MetricCard.jsx'

export default function QuizReportPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Assigned" value="201" helper="users who clicked" icon="ti-users" />
        <MetricCard label="Completed" value="143" helper="71% completion rate" helperClass="text-emerald-600" icon="ti-circle-check" />
        <MetricCard label="Failed (< 60%)" value="38" helper="needs coaching escalation" helperClass="text-red-600" icon="ti-circle-x" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Status per user</h3>
            <button onClick={() => toast.success('Reminder sent to target users.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Send reminder
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Dept</th>
                  <th className="py-2.5 px-4">Score</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Budi Santoso', 'Finance', '40%', 'Failed', '8 Jul', 'bg-red-100 text-red-700', 'text-red-600'],
                  ['Sari Dewi', 'HR', '75%', 'Passed', '8 Jul', 'bg-emerald-100 text-emerald-700', 'text-emerald-600'],
                  ['Andi Pratama', 'Marketing', '—', 'Pending', '8 Jul', 'bg-amber-100 text-amber-700', 'text-gray-400'],
                ].map(([name, dept, score, status, deadline, badge, scoreCls]) => (
                  <tr key={name} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 font-semibold text-gray-900">{name}</td>
                    <td className="py-2.5 px-4">{dept}</td>
                    <td className={clsx('py-2.5 px-4 font-semibold', scoreCls)}>{score}</td>
                    <td className="py-2.5 px-4"><span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', badge)}>{status}</span></td>
                    <td className="py-2.5 px-4 text-gray-500">{deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Active question bank</h3>
            <button onClick={() => toast.success('The simulation question builder is open.')} className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Add question
            </button>
          </div>
          {[
            ['What should you do if you receive an email from the CEO requesting a fund transfer?', 'Multiple choice · Correct: 61%'],
            ['Which signs of a phishing email are correct?', 'Multiple choice · Correct: 74%'],
            ['Which link is safe to click?', 'Multiple choice · Correct: 58%'],
          ].map(([question, meta]) => (
            <div key={question} className="border border-gray-200 rounded-xl p-3 bg-white space-y-1.5 text-xs">
              <h4 className="font-medium text-gray-900 leading-relaxed">{question}</h4>
              <p className="text-gray-500 text-[10px] font-semibold">{meta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
