import { useMemo } from 'react'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import { useMyProfile } from '../../hooks/queries/useProfileQueries.js'
import { useQuizResults } from '../../hooks/queries/useQuizQueries.js'
import { QuizResultsPanel } from '../../features/quiz/components/index.js'

/**
 * Quiz Results (docs/PRD_QUIZ_MODULE.md FR-16) — its own page under Quiz in
 * the sidebar rather than a third tab of the Quiz Module, which PRD FR-1
 * scopes to Question Bank and Quiz Page.
 */
export default function QuizResults() {
  const { data: profile } = useMyProfile()
  const entityName = String(profile?.entity || '').trim()

  const requestExtras = useMemo(() => ({}), [])
  const results = useQuizResults(requestExtras)

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Quiz Results"
        subtitle={entityName ? `Graded quiz answers for ${entityName}` : 'Graded quiz answers'}
      />

      <QuizResultsPanel
        data={results.data}
        isLoading={results.isLoading}
        isError={results.isError}
        error={results.error}
      />
    </PageShell>
  )
}
