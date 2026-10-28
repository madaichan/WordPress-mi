/**
 * Derivations behind the Quiz Dashboard (docs/PRD_QUIZ_MODULE.md FR-16).
 *
 * Everything here is pure: the page hands in the `/quiz/results` payload plus
 * the question bank and quiz list it already fetched, and gets back rows ready
 * to render. Kept out of the components so the arithmetic is testable on its
 * own — the charts then only decide how to draw it.
 *
 * One rule runs through all of it: a result row is one *arrival*, not one
 * person. Someone who answered twice has two rows, so anything counting people
 * folds the rows down by target first, keeping their latest attempt — the same
 * attempt risk scoring uses (PRD FR-14).
 */

/** Score buckets for the distribution chart, 20 points wide. */
const BUCKET_SIZE = 20

/**
 * Submissions per score bucket, lowest first. `below` marks a bucket whose
 * whole range sits under the pass mark, so the chart can say which bars are
 * failures without inventing a second colour series.
 */
export function scoreBuckets(rows = [], passScore = 0) {
  const buckets = []
  for (let floor = 0; floor < 100; floor += BUCKET_SIZE) {
    const ceiling = floor + BUCKET_SIZE - 1
    buckets.push({
      label: `${floor}–${ceiling === 99 ? 100 : ceiling}`,
      floor,
      count: 0,
      below: ceiling < passScore,
    })
  }

  rows.forEach((row) => {
    const score = clampScore(row?.score)
    const index = Math.min(buckets.length - 1, Math.floor(score / BUCKET_SIZE))
    buckets[index].count += 1
  })

  return buckets
}

/**
 * The questions people get wrong most often, worst first.
 *
 * `per_question` arrives with each question's own denominator and its
 * `question_id`; the bank supplies the wording, so a question deleted from the
 * bank since it was asked still shows up, just under its input name.
 */
export function hardestQuestions(perQuestion = [], questions = [], limit = 5) {
  const byId = new Map(questions.map(q => [Number(q.id), q]))

  return perQuestion
    .filter(entry => Number(entry?.asked) > 0)
    .map((entry) => {
      const question = byId.get(Number(entry.question_id))
      return {
        inputName: String(entry.input_name || ''),
        questionId: Number(entry.question_id) || 0,
        text: question?.question || '',
        difficulty: Number(question?.difficulty) || 0,
        asked: Number(entry.asked) || 0,
        wrong: Number(entry.wrong) || 0,
        wrongRate: Math.round((Number(entry.wrong) / Number(entry.asked)) * 100),
      }
    })
    .sort((a, b) => b.wrongRate - a.wrongRate || b.asked - a.asked)
    .slice(0, limit)
}

/**
 * One entry per target, holding their latest attempt and how many attempts
 * they made. Ordered newest attempt first.
 */
export function attemptsByTarget(rows = []) {
  const byEmail = new Map()

  rows.forEach((row) => {
    const email = String(row?.target_email || '').trim().toLowerCase()
    if (!email) return

    const existing = byEmail.get(email)
    if (!existing) {
      byEmail.set(email, { email, latest: row, attempts: 1 })
      return
    }

    existing.attempts += 1
    if (sortableTime(row) > sortableTime(existing.latest)) {
      existing.latest = row
    }
  })

  return [...byEmail.values()].sort((a, b) => sortableTime(b.latest) - sortableTime(a.latest))
}

/**
 * Headline numbers the summary cards show. `uniqueTargets` is deliberately not
 * `total`: the difference between them is exactly the people who retried.
 */
export function submissionSummary(rows = []) {
  const targets = attemptsByTarget(rows)
  const scores = rows.map(row => clampScore(row?.score)).sort((a, b) => a - b)

  return {
    total: rows.length,
    uniqueTargets: targets.length,
    retried: targets.filter(target => target.attempts > 1).length,
    median: median(scores),
    lowest: scores.length ? scores[0] : 0,
  }
}

/**
 * Targets worth chasing: their latest attempt failed. Worst score first, and
 * someone who has already failed more than once outranks a first-time failure
 * on the same score.
 */
export function followUpTargets(rows = [], limit = 10) {
  return attemptsByTarget(rows)
    .filter(target => !target.latest?.passed)
    .map(target => ({
      email: target.latest.target_email || target.email,
      attempts: target.attempts,
      score: clampScore(target.latest.score),
      correctCount: Number(target.latest.correct_count) || 0,
      questionCount: Number(target.latest.question_count) || 0,
      completedAt: target.latest.completed_at || '',
    }))
    .sort((a, b) => a.score - b.score || b.attempts - a.attempts)
    .slice(0, limit)
}

/**
 * Per campaign run, oldest first — the shape the trend chart and its table
 * both read.
 *
 * Runs come from the participation block — only the runs whose chain leads to
 * a quiz, either simulation → quiz (`via` direct) or simulation → education →
 * quiz (`via` education), which the backend has already filtered down. A run
 * that chained to education alone never offered a quiz and so is not here.
 *
 * Results come from the graded rows, so a run where nobody answered still
 * appears, with a participation rate of 0 and no score. That is the point: an
 * empty run is a delivery problem, not a knowledge problem, and hiding it
 * would make the trend look better than it is.
 */
export function trendByRun(rows = [], runs = []) {
  const resultsByRun = new Map()
  rows.forEach((row) => {
    const runId = Number(row?.campaign_run_id) || 0
    if (!runId) return
    if (!resultsByRun.has(runId)) resultsByRun.set(runId, [])
    resultsByRun.get(runId).push(row)
  })

  return runs
    .map((run) => {
      const runRows = resultsByRun.get(Number(run.id)) || []
      const reached = Number(run.reached) || 0
      const completed = Number(run.completed) || 0

      return {
        runId: Number(run.id),
        name: String(run.name || `Run ${run.id}`),
        launchedAt: String(run.launched_at || ''),
        via: run.via === 'education' ? 'education' : 'direct',
        submissions: runRows.length,
        reached,
        completed,
        participation: reached > 0 ? Math.round((completed / reached) * 100) : 0,
        avgScore: runRows.length ? Math.round(average(runRows.map(row => clampScore(row.score)))) : null,
        passRate: runRows.length
          ? Math.round((runRows.filter(row => row.passed).length / runRows.length) * 100)
          : null,
      }
    })
    .sort((a, b) => a.launchedAt.localeCompare(b.launchedAt) || a.runId - b.runId)
}

/**
 * Per quiz, busiest first — which of an entity's quizzes the answers came from.
 * Quizzes nobody has answered are left out; the Quiz Page list already shows
 * those.
 */
export function breakdownByQuiz(rows = [], quizzes = []) {
  const titles = new Map(quizzes.map(quiz => [Number(quiz.id), quiz.title]))
  const byQuiz = new Map()

  rows.forEach((row) => {
    const id = Number(row?.quiz_page_id) || 0
    if (!byQuiz.has(id)) byQuiz.set(id, [])
    byQuiz.get(id).push(row)
  })

  return [...byQuiz.entries()]
    .map(([id, quizRows]) => ({
      quizId: id,
      title: titles.get(id) || (id ? `Quiz #${id}` : 'Unlinked submissions'),
      submissions: quizRows.length,
      avgScore: Math.round(average(quizRows.map(row => clampScore(row.score)))),
      passRate: Math.round((quizRows.filter(row => row.passed).length / quizRows.length) * 100),
    }))
    .sort((a, b) => b.submissions - a.submissions)
}

/** The pass mark actually applied to these submissions, for the chart's marker. */
export function effectivePassScore(rows = [], fallback = 70) {
  const marks = rows.map(row => Number(row?.pass_score_used)).filter(mark => mark > 0)
  return marks.length ? Math.max(...marks) : fallback
}

function clampScore(value) {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, Math.round(score)))
}

function sortableTime(row) {
  const stamp = Date.parse(String(row?.completed_at || row?.created_at || ''))
  return Number.isNaN(stamp) ? Number(row?.id) || 0 : stamp
}

function average(numbers) {
  return numbers.length ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0
}

function median(sorted) {
  if (!sorted.length) return 0
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}
