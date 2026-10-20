import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'

const TABS = [
  { key: 'report', label: 'Report', icon: 'ti-file-analytics' },
  { key: 'quiz', label: 'Quiz', icon: 'ti-help' },
  { key: 'coaching', label: 'Coaching', icon: 'ti-school' },
  { key: 'planning', label: 'Next planning', icon: 'ti-calendar-plus' },
]

const DEPARTMENTS = [
  { dept: 'Finance', pct: 52, color: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  { dept: 'HR', pct: 40, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { dept: 'Marketing', pct: 24, color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { dept: 'Engineering', pct: 6, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { dept: 'Legal', pct: 4, color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
]

function Metric({ label, value, sub, icon, subCls = 'text-ink-muted' }) {
  return (
    <div className="bg-panel border border-line rounded-xl p-5 flex items-start justify-between">
      <div className="space-y-1">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="block text-2xl font-bold text-ink">{value}</span>
        <span className={clsx('block text-xs font-semibold', subCls)}>{sub}</span>
      </div>
      <div className="w-9 h-9 bg-panel-subtle rounded-lg flex items-center justify-center text-ink-faint">
        <i className={clsx('ti text-lg', icon)} />
      </div>
    </div>
  )
}

function DepartmentBars() {
  return (
    <div className="space-y-4">
      {DEPARTMENTS.map(row => (
        <div key={row.dept} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-ink-soft">{row.dept}</span>
            <span className={clsx('font-bold', row.text)}>{row.pct}%</span>
          </div>
          <div className="w-full bg-panel-muted h-2 rounded-full overflow-hidden">
            <div className={clsx('h-full rounded-full', row.color)} style={{ width: `${row.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportPane() {
  const users = [
    ['Budi Santoso', 'Finance', 'Yes', 'Yes', 'Failed', '91', 'High', 'bg-red-500/15 text-red-700 dark:text-red-300', 'text-red-600 dark:text-red-400'],
    ['Sari Dewi', 'HR', 'Yes', 'Yes', 'Passed', '78', 'High', 'bg-red-500/15 text-red-700 dark:text-red-300', 'text-red-600 dark:text-red-400'],
    ['Andi Pratama', 'Marketing', 'Yes', 'No', 'Passed', '54', 'Medium', 'bg-amber-500/15 text-amber-700 dark:text-amber-300', 'text-amber-600 dark:text-amber-400'],
    ['Rina Wijaya', 'Legal', 'No', 'No', 'Passed', '12', 'Low', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', 'text-emerald-600 dark:text-emerald-400'],
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Metric label="Click rate" value="18%" sub="▲ 3% vs previous simulation" subCls="text-red-600 dark:text-red-400" icon="ti-pointer" />
        <Metric label="Submit rate" value="8%" sub="▲ 2% vs previous simulation" subCls="text-red-600 dark:text-red-400" icon="ti-forms" />
        <Metric label="Risk score org." value="64" sub="Medium — needs attention" subCls="text-amber-600 dark:text-amber-400" icon="ti-alert-triangle" />
        <Metric label="High-risk users" value="42" sub="▲ 8 from the Q1 simulation" subCls="text-red-600 dark:text-red-400" icon="ti-users" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-3 space-y-6">
          <h3 className="text-base font-semibold text-ink">Click rate by department</h3>
          <DepartmentBars />
          <hr className="border-line-soft" />
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-ink">Benchmark vs. previous simulation</h4>
            {[
              ['Q2 (current)', 18, 'bg-red-500', 'text-red-600 dark:text-red-400'],
              ['Q1 2025', 15, 'bg-violet-500', 'text-violet-500'],
              ['Q4 2024', 22, 'bg-ink-faint', 'text-ink-muted'],
            ].map(([label, pct, color, text]) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-ink-soft">{label}</span>
                  <span className={clsx('font-bold', text)}>{pct}%</span>
                </div>
                <div className="w-full bg-panel-muted h-1.5 rounded-full overflow-hidden">
                  <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-panel border border-line rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-ink">Organizational risk score</h3>
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full border-2 border-red-500 flex flex-col items-center justify-center flex-shrink-0 select-none">
                <span className="text-2xl font-bold text-red-500 leading-none">64</span>
                <span className="text-[10px] text-ink-faint font-medium mt-0.5">/ 100</span>
              </div>
              <div className="flex-grow space-y-2">
                {[
                  ['Click history', '40 points'],
                  ['Quiz score', '15 points'],
                  ['Submit form', '9 points'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs border-b border-line-soft pb-1.5 last:border-b-0">
                    <span className="text-ink-muted">{label}</span>
                    <span className="font-semibold text-ink-soft">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-panel border border-line rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <i className="ti ti-bulb text-lg" />
              <h3 className="text-sm font-semibold text-ink">Recommendation</h3>
            </div>
            {[
              ['Coaching focus — Finance & HR', '52% of Finance and 40% of HR clicked. Send the BEC awareness module immediately.'],
              ['42 users need mandatory coaching', "Assign the Recognize BEC module to all high-risk users within 48 hours."],
              ['Schedule the next simulation', 'Reduce click rate to <12% in Q3.'],
            ].map(([title, desc]) => (
              <div key={title} className="bg-panel-subtle rounded-lg p-3 text-xs">
                <h4 className="font-bold text-ink">{title}</h4>
                <p className="text-ink-muted mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">Risk score per user</h3>
          <button onClick={() => toast.success('CSV export is being prepared.')} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-ink-soft">
            <thead>
              <tr className="bg-panel-subtle border-b border-line text-[10px] font-bold text-ink-muted uppercase tracking-wider">
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
              {users.map(([name, dept, click, submit, quiz, score, level, badge, scoreCls]) => (
                <tr key={name} className="border-b border-line-soft last:border-0 hover:bg-panel-subtle/50">
                  <td className="py-2.5 px-4 font-semibold text-ink">{name}</td>
                  <td className="py-2.5 px-4">{dept}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', click === 'Yes' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{click}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', submit === 'Yes' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{submit}</td>
                  <td className={clsx('py-2.5 px-4 font-semibold', quiz === 'Failed' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>{quiz}</td>
                  <td className={clsx('py-2.5 px-4 font-bold', scoreCls)}>{score}</td>
                  <td className="py-2.5 px-4"><span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', badge)}>{level}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function QuizPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Metric label="Assigned" value="201" sub="users who clicked" icon="ti-users" />
        <Metric label="Completed" value="143" sub="71% completion rate" subCls="text-emerald-600 dark:text-emerald-400" icon="ti-circle-check" />
        <Metric label="Failed (< 60%)" value="38" sub="needs coaching escalation" subCls="text-red-600 dark:text-red-400" icon="ti-circle-x" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Status per user</h3>
            <button onClick={() => toast.success('Reminder sent to target users.')} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">Send reminder</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-ink-soft">
              <thead>
                <tr className="bg-panel-subtle border-b border-line text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Dept</th>
                  <th className="py-2.5 px-4">Score</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Budi Santoso', 'Finance', '40%', 'Failed', 'bg-red-500/15 text-red-700 dark:text-red-300'],
                  ['Sari Dewi', 'HR', '75%', 'Passed', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'],
                  ['Andi Pratama', 'Marketing', '—', 'Pending', 'bg-amber-500/15 text-amber-700 dark:text-amber-300'],
                ].map(([name, dept, score, status, badge]) => (
                  <tr key={name} className="border-b border-line-soft last:border-0 hover:bg-panel-subtle/50">
                    <td className="py-2.5 px-4 font-semibold text-ink">{name}</td>
                    <td className="py-2.5 px-4">{dept}</td>
                    <td className="py-2.5 px-4 font-semibold">{score}</td>
                    <td className="py-2.5 px-4"><span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', badge)}>{status}</span></td>
                    <td className="py-2.5 px-4 text-ink-muted">8 Jul</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Active question bank</h3>
            <button onClick={() => toast.success('The simulation question builder is open.')} className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">Add question</button>
          </div>
          {[
            ['What should you do if you receive an email from the CEO requesting a fund transfer?', 'Multiple choice · Correct: 61%'],
            ['Which signs of a phishing email are correct?', 'Multiple choice · Correct: 74%'],
            ['Which link is safe to click?', 'Multiple choice · Correct: 58%'],
          ].map(([question, meta]) => (
            <div key={question} className="border border-line rounded-xl p-3 bg-panel space-y-1.5 text-xs">
              <h4 className="font-medium text-ink leading-relaxed">{question}</h4>
              <p className="text-ink-muted text-[10px] font-semibold">{meta}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CoachingPane() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Metric label="High-risk assigned" value="42" sub="100% already assigned modules" subCls="text-emerald-600 dark:text-emerald-400" icon="ti-school" />
        <Metric label="Completed coaching" value="18" sub="43% completion" icon="ti-circle-check" />
        <Metric label="Active drip campaigns" value="3" sub="Weekly tips running" icon="ti-mail" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-ink">Progress by user</h3>
            <button onClick={() => toast.success('Escalation notification sent to department managers.')} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">Notif. manager</button>
          </div>
          {[
            ['BS', 'Budi Santoso', 'Finance · Module: Recognize BEC', 20],
            ['SD', 'Sari Dewi', 'HR · Module: Recognize BEC + Social Engineering', 60],
            ['AP', 'Andi Pratama', 'Marketing · Module: Phishing 101', 100],
          ].map(([initials, name, meta, pct]) => (
            <div key={name} className="flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 font-semibold flex items-center justify-center flex-shrink-0 select-none">{initials}</div>
              <div className="flex-grow">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-ink">{name}</span>
                  <span className={pct === 100 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-violet-500 font-semibold'}>{pct === 100 ? 'Completed' : `${pct}%`}</span>
                </div>
                <p className="text-ink-faint text-[10px] mt-0.5">{meta}</p>
                <div className="w-full bg-panel-strong h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div className={clsx('h-1.5 rounded-full', pct === 100 ? 'bg-emerald-500' : 'bg-violet-500')} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-panel border border-line rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Active drip campaigns</h3>
            <button onClick={() => toast.success('Opening the new drip campaign dialog.')} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">Create new</button>
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

function PlanningPane() {
  return (
    <div className="space-y-6">
      <div className="bg-panel border border-line rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <i className="ti ti-sparkles text-lg animate-pulse" />
          <h3 className="text-base font-semibold text-ink">Recommended next scenarios</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            ['Q3 — Finance Deep Dive', 'Focus on Finance, which still has a click rate 52%. Use a more complex wire-fraud scenario.', 'Recommendation'],
            ['Q3 — Org-wide Awareness', 'A light simulation for the whole organization. Focus on raising the awareness baseline across all departments.', 'Credential'],
            ['Q3 — Vishing + Smishing', 'Add a new dimension: phishing simulations by phone and SMS.', 'Vishing'],
          ].map(([title, desc, badge], index) => (
            <Link key={title} to="/campaigns" className={clsx('rounded-xl p-4 flex flex-col justify-between h-44', index === 0 ? 'border-2 border-violet-500 bg-violet-50/5' : 'border border-line bg-panel')}>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-xs font-bold text-ink">{title}</h4>
                  <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">{badge}</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('report')

  return (
    <PageShell>
      <PageHeader
        title="Q2 Phishing Wave — Finance"
        subtitle="Completed 5 Jul 2025 · Duration 7 days · 1,240 targets"
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success('CSV export is being prepared.')}>
              Export CSV
            </Button>
            <Button variant="primary" onClick={() => toast.success('PDF download is being prepared.')}>
              <i className="ti ti-download text-base" />
              <span>Download PDF</span>
            </Button>
          </>
        }
      />

      <div className="border-b border-line">
        <nav className="flex gap-6 -mb-px overflow-x-auto no-scrollbar" aria-label="Tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none whitespace-nowrap',
                activeTab === tab.key ? 'border-violet-500 text-violet-500' : 'border-transparent text-ink-muted hover:text-ink-soft hover:border-line-strong',
              )}
            >
              <i className={clsx('ti text-base', tab.icon)} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'report' && <ReportPane />}
      {activeTab === 'quiz' && <QuizPane />}
      {activeTab === 'coaching' && <CoachingPane />}
      {activeTab === 'planning' && <PlanningPane />}
    </PageShell>
  )
}
