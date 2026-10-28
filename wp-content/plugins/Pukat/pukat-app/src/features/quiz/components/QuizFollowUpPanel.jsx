import { Link } from 'react-router-dom'
import Badge from '../../../components/UI/Badge.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'

/**
 * Who to chase: targets whose latest attempt failed, worst score first.
 *
 * Latest attempt, not worst attempt — someone who failed and then passed has
 * learned the material, and risk scoring already treats their last try as the
 * one that counts (PRD FR-14).
 */
export default function QuizFollowUpPanel({ targets = [], hasSubmissions = false }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Needs follow-up</h3>
          <p className="text-[11px] text-ink-faint">
            Targets whose most recent attempt was below the pass mark.
          </p>
        </div>
        <Link
          to="/post/coaching"
          className="shrink-0 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400"
        >
          Coaching →
        </Link>
      </div>

      {targets.length === 0 ? (
        <EmptyState
          icon={hasSubmissions ? 'ti-mood-happy' : 'ti-clipboard-text'}
          title={hasSubmissions ? 'Everyone has passed' : 'No answers yet'}
          description={hasSubmissions
            ? 'Every target who answered is at or above the pass mark on their latest attempt.'
            : 'Targets appear here once answers are graded.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-ink-soft">
            <thead>
              <tr className="border-b border-line text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Latest score</th>
                <th className="py-2 pr-3">Correct</th>
                <th className="py-2 pr-3">Attempts</th>
                <th className="py-2">Last answered</th>
              </tr>
            </thead>
            <tbody>
              {targets.map(target => (
                <tr key={target.email} className="border-b border-line-soft last:border-0">
                  <td className="py-2 pr-3 text-ink">{target.email}</td>
                  <td className="py-2 pr-3 font-semibold text-red-600 dark:text-red-400">{target.score}%</td>
                  <td className="py-2 pr-3">{target.correctCount}/{target.questionCount}</td>
                  <td className="py-2 pr-3">
                    {target.attempts > 1
                      ? <Badge tone="warning">{target.attempts} attempts</Badge>
                      : <span className="text-ink-faint">1</span>}
                  </td>
                  <td className="py-2">{target.completedAt || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
