import clsx from 'clsx'
import Badge from '../../../components/UI/Badge.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import StatCard from '../../../components/UI/StatCard.jsx'

/**
 * Graded quiz results (docs/PRD_QUIZ_MODULE.md FR-16): a summary, one row per
 * arrival, and the per-question breakdown.
 *
 * Each question carries its own denominator on purpose — a question added
 * after some people had already answered was simply not asked of everyone, so
 * a single shared total would misreport it.
 */
export default function QuizResultsPanel({ data, isLoading = false, isError = false, error = null }) {
  if (isLoading) return <p className="text-sm text-ink-faint">Loading results…</p>
  if (isError) return <p className="text-sm text-danger">{error?.message || 'Could not load quiz results.'}</p>

  const rows = data?.results || []
  const perQuestion = data?.per_question || []

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="ti-clipboard-text"
        title="No quiz answers yet"
        description="Results appear here once targets submit the quiz. Answers are graded when a campaign's results are synced."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          icon="ti-clipboard-check"
          iconBg="bg-violet-500/10"
          iconColor="text-violet-500"
          label="Submissions"
          value={String(data.total ?? rows.length)}
        />
        <StatCard
          icon="ti-circle-check"
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          label="Passed"
          value={String(data.passed ?? 0)}
        />
        <StatCard
          icon="ti-circle-x"
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          label="Failed"
          value={String(data.failed ?? 0)}
        />
        <StatCard
          icon="ti-percentage"
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
          label="Average score"
          value={`${data.avg_score ?? 0}%`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-ink-soft">
            <thead>
              <tr className="border-b border-line bg-panel-subtle text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Score</th>
                <th className="px-4 py-2.5">Correct</th>
                <th className="px-4 py-2.5">Result</th>
                <th className="px-4 py-2.5">Pass mark</th>
                <th className="px-4 py-2.5">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5 text-ink">{row.target_email || '—'}</td>
                  <td className={clsx('px-4 py-2.5 font-semibold', row.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {row.score}%
                  </td>
                  <td className="px-4 py-2.5">{row.correct_count}/{row.question_count}</td>
                  <td className="px-4 py-2.5">
                    {row.passed ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Failed</Badge>}
                  </td>
                  <td className="px-4 py-2.5">{row.pass_score_used}%</td>
                  <td className="px-4 py-2.5">{row.completed_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {perQuestion.length > 0 && (
        <div className="space-y-3 rounded-xl border border-line bg-panel p-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Per question</h3>
            <p className="text-[11px] text-ink-faint">
              Each question counts only the submissions that were actually asked it, so a question added later is not penalised.
            </p>
          </div>
          <div className="space-y-2">
            {perQuestion.map(entry => {
              const pct = entry.asked > 0 ? Math.round((entry.wrong / entry.asked) * 100) : 0
              return (
                <div key={entry.input_name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-ink-soft">{entry.input_name}</span>
                    <span className="text-ink-muted">{entry.wrong} of {entry.asked} wrong ({pct}%)</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-panel-muted">
                    <div className="h-full rounded-full bg-red-500/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
