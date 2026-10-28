import { Link } from 'react-router-dom'
import Badge from '../../../components/UI/Badge.jsx'

/**
 * Is the quiz actually wired up? The chain only ever reaches the entity's
 * default follow-up quiz (PRD §13.9), so that one quiz is what this reports:
 * whether it exists, is published, and has been pushed to GoPhish.
 *
 * Every problem it can report is fixed on the Quiz Page tab, so each line
 * links there rather than explaining what to click.
 */
export default function QuizStatusStrip({ quizzes = [], isLoading = false }) {
  if (isLoading) {
    return <p className="rounded-xl border border-line bg-panel px-4 py-3 text-xs text-ink-faint">Checking quiz status…</p>
  }

  const defaultQuiz = quizzes.find(quiz => quiz.is_default_followup)
  const published = Boolean(defaultQuiz && defaultQuiz.status === 'published')
  const synced = Boolean(defaultQuiz?.gophish_master_id)
  const problem = !defaultQuiz
    ? 'No quiz is set as the follow-up, so a simulation has nothing to chain into.'
    : !published
      ? 'The follow-up quiz is still a draft — publish it before the next run.'
      : !synced
        ? 'The follow-up quiz is published but has never been pushed to GoPhish.'
        : ''

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <i className={`ti ${problem ? 'ti-alert-triangle text-amber-500' : 'ti-circle-check text-emerald-500'} text-base`} />
        <span className="truncate text-xs font-semibold text-ink">
          {defaultQuiz ? defaultQuiz.title || `Quiz #${defaultQuiz.id}` : 'No follow-up quiz'}
        </span>
        <Badge tone={published ? 'success' : 'warning'}>{published ? 'Published' : defaultQuiz?.status || 'missing'}</Badge>
        {defaultQuiz && (
          <Badge tone={synced ? 'info' : 'gray'}>{synced ? 'On GoPhish' : 'Not pushed'}</Badge>
        )}
      </div>

      <p className="min-w-0 flex-1 text-[11px] text-ink-faint">{problem}</p>

      <Link to="/post/quiz" className="shrink-0 text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
        {problem ? 'Fix on Quiz Page' : 'Quiz Page'} →
      </Link>
    </div>
  )
}
