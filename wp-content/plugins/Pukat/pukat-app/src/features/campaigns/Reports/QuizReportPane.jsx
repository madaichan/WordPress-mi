import { Link } from 'react-router-dom'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import { useQuizResults } from '../../../hooks/queries/useQuizQueries.js'
import { QuizResultsPanel } from '../../quiz/components/index.js'

/**
 * Quiz results for one campaign run inside the report view
 * (docs/PRD_QUIZ_MODULE.md FR-16).
 *
 * Takes `campaignRunId` because quiz answers are recorded per run. The report
 * view around this pane is still static mock content and has no run in hand,
 * so without the prop this says so instead of inventing numbers — the same
 * data is available per entity under Post Simulation → Quiz → Results.
 */
export default function QuizReportPane({ campaignRunId = null }) {
  const enabled = Boolean(campaignRunId)
  const { data, isLoading, isError, error } = useQuizResults(
    { campaign_run_id: campaignRunId },
    { enabled }
  )

  if (!enabled) {
    return (
      <EmptyState
        icon="ti-help-circle"
        title="No campaign run selected"
        description="Quiz answers are graded per campaign run. Open a run's monitoring page, or see every graded answer for your entity under Post Simulation → Quiz."
        action={(
          <Link to="/post/quiz" className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400">
            Open the Quiz module
          </Link>
        )}
      />
    )
  }

  return <QuizResultsPanel data={data} isLoading={isLoading} isError={isError} error={error} />
}
