import clsx from 'clsx'
import toast from 'react-hot-toast'
import ReportPane from './ReportPane.jsx'
import QuizReportPane from './QuizReportPane.jsx'
import CoachingReportPane from './CoachingReportPane.jsx'
import PlanningReportPane from './PlanningReportPane.jsx'

export default function ReportView({ activeTab, onTabChange, onNew }) {
  const tabs = [
    { key: 'report', label: 'Report', icon: 'ti-file-analytics' },
    { key: 'quiz', label: 'Quiz', icon: 'ti-help' },
    { key: 'coaching', label: 'Coaching', icon: 'ti-school' },
    { key: 'planning', label: 'Next planning', icon: 'ti-calendar-plus' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Q2 Phishing Wave — Finance</h2>
          <p className="text-sm text-gray-500 mt-0.5">Completed 5 Jul 2025 · Duration 7 days · 1,240 targets</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => toast.success('CSV export is being prepared.')} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Export CSV
          </button>
          <button onClick={() => toast.success('PDF download is being prepared.')} className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all">
            <i className="ti ti-download text-base" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 overflow-x-auto no-scrollbar">
        <nav className="flex gap-6 min-w-max" aria-label="Report tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={clsx(
                'flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none',
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <i className={clsx('ti text-base', tab.icon)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'report' && <ReportPane />}
      {activeTab === 'quiz' && <QuizReportPane />}
      {activeTab === 'coaching' && <CoachingReportPane />}
      {activeTab === 'planning' && <PlanningReportPane onNew={onNew} />}
    </div>
  )
}
