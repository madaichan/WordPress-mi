import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Select from '../../components/UI/Select.jsx'
import StatCard from '../../components/UI/StatCard.jsx'
import { useMyProfile } from '../../hooks/queries/useProfileQueries.js'
import { useQuizPages, useQuizQuestions, useQuizResults } from '../../hooks/queries/useQuizQueries.js'
import { useRefreshQuizResultsMutation } from '../../hooks/mutations/useQuizMutations.js'
import {
  breakdownByQuiz,
  effectivePassScore,
  followUpTargets,
  hardestQuestions,
  scoreBuckets,
  submissionSummary,
  trendByRun,
} from '../../utils/quizDashboard.js'
import {
  QuizFollowUpPanel,
  QuizHardestQuestions,
  QuizPerQuizTable,
  QuizRefreshBar,
  QuizScoreDistribution,
  QuizStatusStrip,
  QuizSubmissionsTable,
  QuizTrendCard,
} from '../../features/quiz/components/index.js'

/**
 * Quiz Dashboard (docs/PRD_QUIZ_MODULE.md FR-16) — the orchestration layer:
 * it owns the queries and the derivations, and hands plain rows to the panels
 * (AGENTS.md §4.2).
 *
 * Its own page rather than a third tab of the Quiz Module, which PRD FR-1
 * scopes to Question Bank and Quiz Page.
 *
 * The quiz filter is client-side on purpose: `/quiz/results` already returns
 * the entity's submissions in one response, so filtering here costs no request
 * and keeps the summary, the charts and the table in step with each other.
 * Freshness is this page's own business: it asks the backend to pull the
 * newest answers from GoPhish when it opens, instead of showing whatever the
 * monitoring cron last stored. That refresh is a quiz-only path — it never
 * goes through the campaign results sync — and the backend throttles it per
 * entity, so opening the page repeatedly costs nothing.
 *
 * Participation is the one number it cannot filter — it is counted per
 * campaign run, not per quiz — so that card and the trend speak for every run
 * that chains into a quiz, and the card says so. Runs that stopped at an
 * education page are not counted at all: they never offered a quiz, so their
 * targets do not belong in the denominator (PRD §13.11).
 */
export default function QuizResults() {
  const [quizFilter, setQuizFilter] = useState('all')

  const { data: profile } = useMyProfile()
  const entityName = String(profile?.entity || '').trim()

  const requestExtras = useMemo(() => ({}), [])
  const results = useQuizResults(requestExtras)
  const refresh = useRefreshQuizResultsMutation(requestExtras)
  const { mutate: refreshResults } = refresh
  const { data: bank } = useQuizQuestions(requestExtras)
  const { data: pagesData, isLoading: loadingPages } = useQuizPages(requestExtras)

  // Memoised rather than `?? []` inline: these feed the useMemo derivations
  // below, and a fresh empty array each render would recompute all of them.
  // Refresh once when the page opens. A mutation rather than a query because
  // it has side effects (an outbound call, graded rows), and guarded by a ref
  // so React's double-invoked effects in development ask only once; the
  // server-side throttle is the real backstop.
  const askedOnce = useRef(false)
  useEffect(() => {
    if (askedOnce.current || !entityName) return
    askedOnce.current = true
    refreshResults()
  }, [entityName, refreshResults])

  const allRows = useMemo(() => results.data?.results || [], [results.data])
  const quizzes = useMemo(() => pagesData?.quizzes || [], [pagesData])
  const questions = useMemo(() => bank?.questions || [], [bank])
  const participation = results.data?.participation || null

  const perQuizRows = useMemo(() => breakdownByQuiz(allRows, quizzes), [allRows, quizzes])
  const rows = useMemo(
    () => (quizFilter === 'all' ? allRows : allRows.filter(row => String(row.quiz_page_id) === quizFilter)),
    [allRows, quizFilter],
  )

  const summary = useMemo(() => submissionSummary(rows), [rows])
  const passScore = useMemo(() => effectivePassScore(rows), [rows])
  const buckets = useMemo(() => scoreBuckets(rows, passScore), [rows, passScore])
  const weakest = useMemo(
    () => hardestQuestions(results.data?.per_question || [], questions),
    [results.data, questions],
  )
  const trend = useMemo(() => trendByRun(rows, participation?.runs || []), [rows, participation])
  const followUp = useMemo(() => followUpTargets(rows), [rows])

  const passed = rows.filter(row => row.passed).length
  const passRate = rows.length ? Math.round((passed / rows.length) * 100) : 0
  const avgScore = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + (Number(row.score) || 0), 0) / rows.length)
    : 0

  if (results.isError) {
    return (
      <PageShell animated={false}>
        <PageHeader title="Quiz Dashboard" subtitle="Graded quiz answers" />
        <p className="text-sm text-danger">{results.error?.message || 'Could not load quiz results.'}</p>
      </PageShell>
    )
  }

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Quiz Dashboard"
        subtitle={entityName ? `Quiz answers and follow-up for ${entityName}` : 'Quiz answers and follow-up'}
      />

      <div className="space-y-6">
        {/* Read off the mutation, not the query cache: another quiz mutation
            invalidating the results key would refetch a payload that has no
            `refresh` block, and the timestamp would vanish from under the
            user. */}
        <QuizRefreshBar
          refresh={refresh.data?.refresh || null}
          isRefreshing={refresh.isPending}
          onRefresh={() => refreshResults()}
        />

        <QuizStatusStrip quizzes={quizzes} isLoading={loadingPages} />

        {perQuizRows.length > 1 && (
          <div className="flex items-center gap-3">
            <label htmlFor="quiz-filter" className="text-xs font-semibold text-ink-muted">Quiz</label>
            <div className="w-72">
              <Select id="quiz-filter" value={quizFilter} onChange={event => setQuizFilter(event.target.value)}>
                <option value="all">All quizzes ({allRows.length})</option>
                {perQuizRows.map(row => (
                  <option key={row.quizId} value={String(row.quizId)}>
                    {row.title} ({row.submissions})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon="ti-clipboard-check"
            iconBg="bg-violet-500/10"
            iconColor="text-violet-500"
            label="Submissions"
            value={results.isLoading ? null : String(summary.total)}
            sub={`${summary.uniqueTargets} target(s)${summary.retried ? `, ${summary.retried} retried` : ''}`}
          />
          <StatCard
            icon="ti-circle-check"
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            label="Pass rate"
            value={results.isLoading ? null : `${passRate}%`}
            sub={`${passed} passed, ${rows.length - passed} failed`}
          />
          <StatCard
            icon="ti-percentage"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            label="Average score"
            value={results.isLoading ? null : `${avgScore}%`}
            sub={`Median ${summary.median}%, lowest ${summary.lowest}%`}
          />
          <StatCard
            icon="ti-users"
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
            label="Participation"
            value={results.isLoading ? null : `${participation?.rate ?? 0}%`}
            sub={participation?.reached
              ? `${participation.completed} of ${participation.reached} reached the quiz — all quiz-linked runs`
              : 'No quiz-linked runs yet'}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <QuizScoreDistribution buckets={buckets} passScore={passScore} total={rows.length} />
          <QuizHardestQuestions questions={weakest} />
        </div>

        <QuizTrendCard trend={trend} />

        <QuizFollowUpPanel targets={followUp} hasSubmissions={rows.length > 0} />

        {perQuizRows.length > 1 && <QuizPerQuizTable rows={perQuizRows} />}

        {rows.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">All submissions</h3>
            <QuizSubmissionsTable rows={rows} />
          </section>
        )}
      </div>
    </PageShell>
  )
}
