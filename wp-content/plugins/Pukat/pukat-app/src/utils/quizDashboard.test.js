import { describe, expect, it } from 'vitest'
import {
  attemptsByTarget,
  breakdownByQuiz,
  effectivePassScore,
  followUpTargets,
  hardestQuestions,
  scoreBuckets,
  submissionSummary,
  trendByRun,
} from './quizDashboard.js'

const row = (overrides = {}) => ({
  id: 1,
  target_email: 'one@example.test',
  score: 100,
  correct_count: 2,
  question_count: 2,
  passed: 1,
  pass_score_used: 70,
  quiz_page_id: 5,
  campaign_run_id: 9,
  completed_at: '2026-10-20 03:00:00',
  ...overrides,
})

describe('scoreBuckets', () => {
  it('counts submissions into five 20-point buckets', () => {
    const buckets = scoreBuckets([
      row({ score: 0 }), row({ score: 19 }), row({ score: 20 }), row({ score: 100 }),
    ])

    expect(buckets.map(b => b.label)).toEqual(['0–19', '20–39', '40–59', '60–79', '80–100'])
    expect(buckets.map(b => b.count)).toEqual([2, 1, 0, 0, 1])
  })

  it('marks only buckets that sit entirely under the pass mark', () => {
    const buckets = scoreBuckets([], 70)

    expect(buckets.filter(b => b.below).map(b => b.label)).toEqual(['0–19', '20–39', '40–59'])
  })

  it('clamps a score outside 0–100 into the end buckets', () => {
    const buckets = scoreBuckets([row({ score: 140 }), row({ score: -5 })])

    expect(buckets[4].count).toBe(1)
    expect(buckets[0].count).toBe(1)
  })
})

describe('hardestQuestions', () => {
  const perQuestion = [
    { input_name: 'answer_q1', question_id: 11, asked: 4, wrong: 1 },
    { input_name: 'answer_q2', question_id: 12, asked: 4, wrong: 3 },
    { input_name: 'answer_q3', question_id: 99, asked: 0, wrong: 0 },
  ]
  const questions = [
    { id: 11, question: 'Spoofed sender?', difficulty: 1 },
    { id: 12, question: 'Urgent password reset?', difficulty: 3 },
  ]

  it('ranks by wrong rate and joins the question wording', () => {
    const hardest = hardestQuestions(perQuestion, questions)

    expect(hardest.map(q => q.inputName)).toEqual(['answer_q2', 'answer_q1'])
    expect(hardest[0]).toMatchObject({ text: 'Urgent password reset?', difficulty: 3, wrongRate: 75 })
  })

  it('drops questions nobody was asked, and survives a question missing from the bank', () => {
    const hardest = hardestQuestions(perQuestion, [])

    expect(hardest.map(q => q.inputName)).toEqual(['answer_q2', 'answer_q1'])
    expect(hardest[0].text).toBe('')
  })

  it('honours the limit', () => {
    expect(hardestQuestions(perQuestion, questions, 1)).toHaveLength(1)
  })
})

describe('attemptsByTarget', () => {
  it('folds a target down to their latest attempt', () => {
    const targets = attemptsByTarget([
      row({ id: 1, score: 40, passed: 0, completed_at: '2026-10-20 03:00:00' }),
      row({ id: 2, score: 90, passed: 1, completed_at: '2026-10-21 03:00:00' }),
    ])

    expect(targets).toHaveLength(1)
    expect(targets[0].attempts).toBe(2)
    expect(targets[0].latest.score).toBe(90)
  })

  it('treats differently-cased addresses as one person', () => {
    const targets = attemptsByTarget([
      row({ id: 1, target_email: 'One@example.test' }),
      row({ id: 2, target_email: 'one@example.test' }),
    ])

    expect(targets).toHaveLength(1)
  })

  it('ignores rows with no target address', () => {
    expect(attemptsByTarget([row({ target_email: '' })])).toEqual([])
  })
})

describe('submissionSummary', () => {
  it('separates arrivals from people and reports the median', () => {
    const summary = submissionSummary([
      row({ id: 1, target_email: 'a@example.test', score: 20 }),
      row({ id: 2, target_email: 'a@example.test', score: 60, completed_at: '2026-10-21 03:00:00' }),
      row({ id: 3, target_email: 'b@example.test', score: 100 }),
    ])

    expect(summary).toMatchObject({ total: 3, uniqueTargets: 2, retried: 1, median: 60, lowest: 20 })
  })

  it('reports zeros for no submissions', () => {
    expect(submissionSummary([])).toMatchObject({ total: 0, uniqueTargets: 0, median: 0, lowest: 0 })
  })
})

describe('followUpTargets', () => {
  it('keeps only targets whose latest attempt failed, worst first', () => {
    const follow = followUpTargets([
      row({ id: 1, target_email: 'fail-low@example.test', score: 10, passed: 0 }),
      row({ id: 2, target_email: 'fail-high@example.test', score: 60, passed: 0 }),
      row({ id: 3, target_email: 'passed@example.test', score: 90, passed: 1 }),
    ])

    expect(follow.map(t => t.email)).toEqual(['fail-low@example.test', 'fail-high@example.test'])
  })

  it('leaves out someone who failed first but passed on their latest attempt', () => {
    const follow = followUpTargets([
      row({ id: 1, target_email: 'retry@example.test', score: 10, passed: 0, completed_at: '2026-10-20 03:00:00' }),
      row({ id: 2, target_email: 'retry@example.test', score: 95, passed: 1, completed_at: '2026-10-22 03:00:00' }),
    ])

    expect(follow).toEqual([])
  })

  it('puts a repeat failure ahead of a first-timer on the same score', () => {
    const follow = followUpTargets([
      row({ id: 1, target_email: 'once@example.test', score: 30, passed: 0 }),
      row({ id: 2, target_email: 'twice@example.test', score: 30, passed: 0 }),
      row({ id: 3, target_email: 'twice@example.test', score: 30, passed: 0, completed_at: '2026-10-21 03:00:00' }),
    ])

    expect(follow[0]).toMatchObject({ email: 'twice@example.test', attempts: 2 })
  })
})

describe('trendByRun', () => {
  const runs = [
    { id: 9, name: 'Run B', launched_at: '2026-10-20 01:00:00', via: 'direct', reached: 4, completed: 2 },
    { id: 8, name: 'Run A', launched_at: '2026-10-18 01:00:00', via: 'education', reached: 10, completed: 5 },
  ]

  it('orders runs oldest first and scores each from its own submissions', () => {
    const trend = trendByRun([
      row({ id: 1, campaign_run_id: 9, score: 100, passed: 1 }),
      row({ id: 2, campaign_run_id: 9, score: 50, passed: 0, target_email: 'two@example.test' }),
    ], runs)

    expect(trend.map(t => t.name)).toEqual(['Run A', 'Run B'])
    expect(trend[1]).toMatchObject({ submissions: 2, avgScore: 75, passRate: 50, participation: 50 })
  })

  it('keeps a run nobody answered, with no score rather than a zero', () => {
    const trend = trendByRun([], runs)

    expect(trend[0]).toMatchObject({ name: 'Run A', submissions: 0, avgScore: null, passRate: null, participation: 50 })
  })

  it('ignores submissions whose run is not in the participation list', () => {
    const trend = trendByRun([row({ campaign_run_id: 404 })], runs)

    expect(trend.reduce((n, t) => n + t.submissions, 0)).toBe(0)
  })

  it('keeps each run\'s linkage, defaulting to the direct one', () => {
    const trend = trendByRun([], [...runs, { id: 10, name: 'Run C', launched_at: '2026-10-22 01:00:00', reached: 1, completed: 0 }])

    expect(trend.map(t => t.via)).toEqual(['education', 'direct', 'direct'])
  })
})

describe('breakdownByQuiz', () => {
  it('groups submissions per quiz, busiest first, naming each from the quiz list', () => {
    const breakdown = breakdownByQuiz([
      row({ id: 1, quiz_page_id: 5, score: 100, passed: 1 }),
      row({ id: 2, quiz_page_id: 5, score: 50, passed: 0 }),
      row({ id: 3, quiz_page_id: 6, score: 80, passed: 1 }),
    ], [{ id: 5, title: 'Q2 follow-up' }])

    expect(breakdown[0]).toMatchObject({ title: 'Q2 follow-up', submissions: 2, avgScore: 75, passRate: 50 })
    expect(breakdown[1].title).toBe('Quiz #6')
  })

  it('labels submissions that are not linked to a quiz', () => {
    expect(breakdownByQuiz([row({ quiz_page_id: 0 })], [])[0].title).toBe('Unlinked submissions')
  })
})

describe('effectivePassScore', () => {
  it('uses the pass mark the submissions were graded against', () => {
    expect(effectivePassScore([row({ pass_score_used: 80 }), row({ pass_score_used: 60 })])).toBe(80)
  })

  it('falls back when no submission carries one', () => {
    expect(effectivePassScore([row({ pass_score_used: 0 })], 65)).toBe(65)
  })
})
