import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'

export default function Coaching() {
  return (
    <PageShell animated={false}>
      <PageHeader title="Coaching" subtitle="Post-simulation awareness education and coaching program" />

      <div className="bg-panel border border-line rounded-xl p-5 max-w-xl">
        <h3 className="text-sm font-semibold text-ink mb-3">Active education modules</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-line-soft pb-2">
            <div>
              <h4 className="text-xs font-semibold text-ink">Recognizing spoofed sender domains</h4>
              <p className="text-[10px] text-ink-faint">Audience: High-risk users (42 enrolled)</p>
            </div>
            <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300">running</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-semibold text-ink">The importance of two-factor authentication (2FA)</h4>
              <p className="text-[10px] text-ink-faint">Audience: All staff</p>
            </div>
            <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">done</span>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
