/**
 * Which of the entity's quizzes the answers came from, busiest first. Only
 * quizzes that have been answered appear — the Quiz Page list already shows
 * the rest.
 */
export default function QuizPerQuizTable({ rows = [] }) {
  return (
    <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">By quiz</h3>
        <p className="text-[11px] text-ink-faint">Each quiz&apos;s own answers, so a weaker quiz is not hidden by a stronger one.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs text-ink-soft">
          <thead>
            <tr className="border-b border-line text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              <th className="py-2 pr-3">Quiz</th>
              <th className="py-2 pr-3">Submissions</th>
              <th className="py-2 pr-3">Avg score</th>
              <th className="py-2">Pass rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.quizId} className="border-b border-line-soft last:border-0">
                <td className="py-2 pr-3 text-ink">{row.title}</td>
                <td className="py-2 pr-3">{row.submissions}</td>
                <td className="py-2 pr-3">{row.avgScore}%</td>
                <td className="py-2">{row.passRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
