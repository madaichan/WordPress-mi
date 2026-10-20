import { Link } from 'react-router-dom'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'

const SCENARIOS = [
  {
    title: 'Q3 — Finance Deep Dive',
    desc: 'Focus on Finance, which still has a click rate 52%. Use a more complex wire-fraud scenario.',
    badge: 'Recommendation',
  },
  {
    title: 'Q3 — Org-wide Awareness',
    desc: 'A light simulation for the whole organization. Focus on raising the awareness baseline across all departments.',
    badge: 'Credential',
  },
  {
    title: 'Q3 — Vishing + Smishing',
    desc: 'Add a new dimension: phishing simulations by phone and SMS.',
    badge: 'Vishing',
  },
]

export default function NextPlanning() {
  return (
    <PageShell animated={false}>
      <PageHeader title="Next planning" subtitle="Recommendations for the next security simulation plan" />

      <div className="bg-panel border border-line rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <i className="ti ti-sparkles text-lg" />
          <h3 className="text-base font-semibold text-ink">Recommended next scenarios</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SCENARIOS.map((scenario, index) => (
            <Link
              key={scenario.title}
              to="/campaigns"
              className={index === 0
                ? 'border-2 border-violet-500 bg-violet-50/5 rounded-xl p-4 flex flex-col justify-between h-44'
                : 'border border-line bg-panel rounded-xl p-4 flex flex-col justify-between h-44'}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-xs font-bold text-ink">{scenario.title}</h4>
                  <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">{scenario.badge}</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{scenario.desc}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-red-500/15 text-red-700 dark:text-red-300">BEC</span>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-panel-muted text-ink-muted">Difficulty 5</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-emerald-500/10 rounded-lg p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2 select-none">
        <i className="ti ti-shield-check text-base text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span>Q3 targets: click rate down to &lt;12% with harder scenarios.</span>
      </div>
    </PageShell>
  )
}
