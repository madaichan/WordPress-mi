import Badge from '../../../components/UI/Badge.jsx'

/**
 * A read-only preview of one bank question, roughly as a target sees it (the
 * question text and its options). For the operator it also marks which options
 * are the answer key — that part is never shown on the live quiz page.
 */
export default function QuestionPreview({ question }) {
  if (!question) return null
  const options = Array.isArray(question.options) ? question.options : []
  const multi = options.filter(o => o.correct).length > 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
        <span className="rounded bg-panel-subtle px-1.5 py-0.5 font-mono text-ink-soft">{question.input_name}</span>
        {question.is_active === false && <Badge tone="gray">Inactive</Badge>}
        <span>difficulty {question.difficulty || 1}</span>
        {question.tags && <span>· {question.tags}</span>}
      </div>

      <p className="text-sm font-semibold text-ink">{question.question}</p>

      {question.question_type === 'image' && question.image_data && (
        <img src={question.image_data} alt={question.question || 'Question image'} className="max-h-64 rounded-lg border border-line" />
      )}

      <ul className="space-y-2">
        {options.map((opt, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-soft"
          >
            <span className={multi ? 'h-4 w-4 flex-shrink-0 rounded border border-line' : 'h-4 w-4 flex-shrink-0 rounded-full border border-line'} />
            <span className="min-w-0 flex-1">{opt.label || opt.value}</span>
            {opt.correct && <Badge tone="success">correct</Badge>}
          </li>
        ))}
      </ul>

      {question.explanation && (
        <p className="rounded-lg bg-panel-subtle/50 px-3 py-2 text-xs text-ink-muted">
          <span className="font-semibold text-ink-soft">Note (internal): </span>{question.explanation}
        </p>
      )}
      <p className="text-[11px] text-ink-faint">The green “correct” marks and this note are only shown here — never on the quiz page.</p>
    </div>
  )
}
