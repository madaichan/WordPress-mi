import EmptyState from '../../../components/UI/EmptyState.jsx'
import StatCard from '../../../components/UI/StatCard.jsx'
import QuizSubmissionsTable from './QuizSubmissionsTable.jsx'

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

      <QuizSubmissionsTable rows={rows} />

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
