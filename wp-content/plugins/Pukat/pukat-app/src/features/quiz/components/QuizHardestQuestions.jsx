import Badge from '../../../components/UI/Badge.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'

const DIFFICULTY_TONE = { 1: 'success', 2: 'warning', 3: 'danger' }
const DIFFICULTY_LABEL = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }

/**
 * Which material is weakest — questions ranked by how often they were answered
 * wrongly, worst first.
 *
 * Each question keeps its own denominator: one added after some people had
 * already answered was simply not asked of everyone, so a shared total would
 * misreport it.
 */
export default function QuizHardestQuestions({ questions = [] }) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-panel p-5">
      <div>
        <h3 className="text-sm font-semibold text-ink">Weakest material</h3>
        <p className="text-[11px] text-ink-faint">
          Questions people get wrong most often. Each counts only the submissions that were actually asked it.
        </p>
      </div>

      {questions.length === 0 ? (
        <EmptyState icon="ti-help-circle" title="No answers to rank yet" description="This fills in once answers are graded." />
      ) : (
        <ol className="space-y-3">
          {questions.map((question, index) => (
            <li key={question.inputName} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">
                    {index + 1}. {question.text || question.inputName}
                  </p>
                  <p className="flex items-center gap-2 text-[10px] text-ink-faint">
                    <span className="font-mono">{question.inputName}</span>
                    {question.difficulty > 0 && (
                      <Badge tone={DIFFICULTY_TONE[question.difficulty] || 'gray'}>
                        {DIFFICULTY_LABEL[question.difficulty] || `Level ${question.difficulty}`}
                      </Badge>
                    )}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold text-ink">
                  {question.wrongRate}%
                  <span className="ml-1 font-normal text-ink-faint">({question.wrong}/{question.asked} wrong)</span>
                </p>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-muted">
                <div className="h-full rounded-full bg-red-500/70" style={{ width: `${question.wrongRate}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
