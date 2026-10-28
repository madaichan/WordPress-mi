import clsx from 'clsx'
import Badge from '../../../components/UI/Badge.jsx'

/**
 * One row per quiz arrival (docs/PRD_QUIZ_MODULE.md FR-16). Shared by the quiz
 * dashboard and the per-run report pane, so it takes rows and nothing else.
 */
export default function QuizSubmissionsTable({ rows = [] }) {
  return (
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
  )
}
