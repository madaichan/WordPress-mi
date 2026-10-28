import { MemoryRouter } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import QuizFollowUpPanel from './QuizFollowUpPanel.jsx'
import QuizHardestQuestions from './QuizHardestQuestions.jsx'
import QuizPerQuizTable from './QuizPerQuizTable.jsx'
import QuizRefreshBar from './QuizRefreshBar.jsx'
import QuizScoreDistribution from './QuizScoreDistribution.jsx'
import QuizStatusStrip from './QuizStatusStrip.jsx'
import QuizSubmissionsTable from './QuizSubmissionsTable.jsx'
import QuizTrendCard from './QuizTrendCard.jsx'

// No jsdom in this project (see PermissionRoute.test.jsx), so these render to
// static markup. That is enough to catch what this layer can get wrong —
// crashes on empty or partial data, and numbers formatted into the wrong cell.
// The recharts plots themselves need a measured container and so stay blank
// here; each chart's text equivalent (its table or its labels) is what gets
// asserted, which is exactly the content a screen reader would also read.
function markup(element) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>)
}

describe('QuizStatusStrip', () => {
  it('warns when no quiz is set as the follow-up', () => {
    const html = markup(<QuizStatusStrip quizzes={[]} />)

    expect(html).toContain('No follow-up quiz')
    expect(html).toContain('nothing to chain into')
  })

  it('warns when the follow-up quiz is still a draft', () => {
    const html = markup(<QuizStatusStrip quizzes={[{ id: 1, title: 'Draft quiz', status: 'draft', is_default_followup: 1 }]} />)

    expect(html).toContain('still a draft')
  })

  it('warns when a published quiz was never pushed to GoPhish', () => {
    const html = markup(<QuizStatusStrip quizzes={[{ id: 1, title: 'Live quiz', status: 'published', is_default_followup: 1 }]} />)

    expect(html).toContain('never been pushed to GoPhish')
    expect(html).toContain('Not pushed')
  })

  it('reports a healthy quiz with no problem line', () => {
    const html = markup(<QuizStatusStrip quizzes={[
      { id: 1, title: 'Live quiz', status: 'published', is_default_followup: 1, gophish_master_id: 42 },
    ]} />)

    expect(html).toContain('On GoPhish')
    expect(html).not.toContain('never been pushed')
  })
})

describe('QuizHardestQuestions', () => {
  it('lists each question with its own denominator', () => {
    const html = markup(<QuizHardestQuestions questions={[
      { inputName: 'answer_q2', text: 'Urgent password reset?', difficulty: 3, asked: 4, wrong: 3, wrongRate: 75 },
    ]} />)

    expect(html).toContain('Urgent password reset?')
    expect(html).toContain('75%')
    expect(html).toContain('(3/4 wrong)')
    expect(html).toContain('Hard')
  })

  it('falls back to the input name when the question left the bank', () => {
    const html = markup(<QuizHardestQuestions questions={[
      { inputName: 'answer_gone', text: '', difficulty: 0, asked: 2, wrong: 2, wrongRate: 100 },
    ]} />)

    expect(html).toContain('answer_gone')
  })

  it('says so when there is nothing to rank', () => {
    expect(markup(<QuizHardestQuestions questions={[]} />)).toContain('No answers to rank yet')
  })
})

describe('QuizFollowUpPanel', () => {
  it('flags a repeat failure', () => {
    const html = markup(<QuizFollowUpPanel hasSubmissions targets={[
      { email: 'twice@example.test', attempts: 2, score: 30, correctCount: 1, questionCount: 3, completedAt: '2026-10-20 03:00:00' },
    ]} />)

    expect(html).toContain('twice@example.test')
    expect(html).toContain('2 attempts')
    expect(html).toContain('1/3')
  })

  it('congratulates rather than empties when everyone passed', () => {
    expect(markup(<QuizFollowUpPanel hasSubmissions targets={[]} />)).toContain('Everyone has passed')
  })

  it('says there are no answers when there are none at all', () => {
    expect(markup(<QuizFollowUpPanel targets={[]} />)).toContain('No answers yet')
  })
})

describe('QuizTrendCard', () => {
  const trend = [
    { runId: 8, name: 'Run A', launchedAt: '2026-10-18 01:00:00', via: 'education', submissions: 0, reached: 10, completed: 0, participation: 0, avgScore: null, passRate: null },
    { runId: 9, name: 'Run B', launchedAt: '2026-10-20 01:00:00', via: 'direct', submissions: 2, reached: 4, completed: 2, participation: 50, avgScore: 75, passRate: 50 },
  ]

  it('tables every run, newest first, with participation', () => {
    const html = markup(<QuizTrendCard trend={trend} />)

    expect(html.indexOf('Run B')).toBeLessThan(html.indexOf('Run A'))
    expect(html).toContain('50%')
    expect(html).toContain('75%')
  })

  it('shows a dash, not a zero, for the scores of a run nobody answered', () => {
    const html = markup(<QuizTrendCard trend={[trend[0]]} />)

    // Exactly two dashes: avg score and pass rate. Participation stays a real
    // 0% — 10 people were sent there and none finished, which is the finding,
    // not missing data.
    expect(html.match(/—/g)).toHaveLength(2)
    expect(html).toContain('>0%<')
  })

  it('names how each run reaches the quiz', () => {
    const html = markup(<QuizTrendCard trend={trend} />)

    expect(html).toContain('Simulation → education → quiz')
    expect(html).toContain('Simulation → quiz')
  })

  it('says so when no run chains into a quiz', () => {
    expect(markup(<QuizTrendCard trend={[]} />)).toContain('No quiz-linked runs yet')
  })
})

describe('QuizPerQuizTable', () => {
  it('names each quiz with its own numbers', () => {
    const html = markup(<QuizPerQuizTable rows={[
      { quizId: 5, title: 'Q2 follow-up', submissions: 2, avgScore: 75, passRate: 50 },
    ]} />)

    expect(html).toContain('Q2 follow-up')
    expect(html).toContain('75%')
  })
})

describe('QuizScoreDistribution', () => {
  it('names the pass mark it was given', () => {
    const html = markup(<QuizScoreDistribution buckets={[{ label: '0–19', floor: 0, count: 1, below: true }]} passScore={80} total={1} />)

    expect(html).toContain('pass mark applied to these answers is 80%')
  })

  it('says so when there is nothing to plot', () => {
    expect(markup(<QuizScoreDistribution buckets={[]} total={0} />)).toContain('Nothing to plot yet')
  })
})

describe('QuizSubmissionsTable', () => {
  it('renders one row per arrival', () => {
    const html = markup(<QuizSubmissionsTable rows={[
      { id: 1, target_email: 'one@example.test', score: 100, correct_count: 2, question_count: 2, passed: 1, pass_score_used: 70, completed_at: '2026-10-20 03:00:00' },
    ]} />)

    expect(html).toContain('one@example.test')
    expect(html).toContain('Passed')
    expect(html).toContain('2/2')
  })

  it('survives an empty set', () => {
    expect(markup(<QuizSubmissionsTable rows={[]} />)).toContain('<table')
  })
})

describe('QuizRefreshBar', () => {
  it('says the data came from the stored sync before any refresh', () => {
    const html = markup(<QuizRefreshBar refresh={null} />)

    expect(html).toContain('last answers the results sync stored')
    expect(html).toContain('Refresh')
  })

  it('reports how many runs were checked once refreshed', () => {
    const html = markup(<QuizRefreshBar refresh={{ refreshed_at: '2026-10-26 02:30:00', polled: 2, warnings: [] }} />)

    expect(html).toContain('Answers pulled from GoPhish at')
    expect(html).toContain('2 active run(s) checked')
  })

  it('shows a run GoPhish could not be asked about as a warning, not an error', () => {
    const html = markup(<QuizRefreshBar refresh={{ refreshed_at: '2026-10-26 02:30:00', polled: 0, warnings: ['Run A could not be refreshed: timeout'] }} />)

    expect(html).toContain('Run A could not be refreshed: timeout')
    expect(html).toContain('text-amber-600')
  })

  it('says what it is doing while refreshing', () => {
    const html = markup(<QuizRefreshBar refresh={null} isRefreshing />)

    expect(html).toContain('Checking GoPhish for new answers')
    expect(html).toContain('disabled')
  })
})
