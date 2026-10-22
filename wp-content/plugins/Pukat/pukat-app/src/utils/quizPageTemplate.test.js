import { describe, expect, it } from 'vitest'
import { buildStarterHtml, quizPageStatus } from './quizPageTemplate.js'

const questions = [
  {
    input_name: 'answer_q1',
    question: 'Email mendesak minta ganti password, apa yang Anda lakukan?',
    options: [
      { label: 'Klik tautannya', value: 'click', correct: false },
      { label: 'Laporkan ke IT', value: 'report', correct: true },
    ],
  },
  {
    input_name: 'answer_q2',
    question: 'Lampiran .zip dari pengirim tak dikenal?',
    options: [
      { label: 'Buka saja', value: 'open', correct: false },
      { label: 'Jangan dibuka', value: 'skip', correct: true },
    ],
  },
]

describe('buildStarterHtml', () => {
  it('builds a POST form with the GoPhish rid token', () => {
    const html = buildStarterHtml(questions)

    expect(html).toContain('<form method="post">')
    expect(html).toContain('name="rid"')
    expect(html).toContain('{{.RId}}')
  })

  it('uses the bank input names, one fieldset per question', () => {
    const html = buildStarterHtml(questions)

    expect(html).toContain('name="answer_q1"')
    expect(html).toContain('name="answer_q2"')
    expect(html.match(/<fieldset class="question">/g)).toHaveLength(2)
  })

  it('shares one input between both languages so the linter sees no duplicate', () => {
    const html = buildStarterHtml(questions)

    // Two options for answer_q1, and not a second copy of the group for English.
    expect(html.match(/name="answer_q1"/g)).toHaveLength(2)
    expect(html).toContain('class="only-id"')
    expect(html).toContain('class="only-en"')
  })

  it('escapes question and option text', () => {
    const html = buildStarterHtml([
      {
        input_name: 'answer_q1',
        question: 'Tanda <script>alert(1)</script> berbahaya?',
        options: [
          { label: 'Ya & benar', value: 'y', correct: true },
          { label: '"Tidak"', value: 'n', correct: false },
        ],
      },
    ])

    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('Ya &amp; benar')
    expect(html).toContain('&quot;Tidak&quot;')
  })

  it('still produces a valid page when the bank is empty', () => {
    const html = buildStarterHtml([])

    expect(html).toContain('<form method="post">')
    expect(html).not.toContain('<fieldset class="question">')
    expect(html).toContain('No active questions in the bank yet')
  })

  it('tolerates a missing argument', () => {
    expect(() => buildStarterHtml()).not.toThrow()
    expect(buildStarterHtml()).toContain('<form method="post">')
  })
})

describe('quizPageStatus', () => {
  it('reports the lifecycle states the editor header renders', () => {
    expect(quizPageStatus(null).key).toBe('none')
    expect(quizPageStatus({ id: null }).key).toBe('none')
    expect(quizPageStatus({ id: 3, status: 'draft' }).key).toBe('draft')
    expect(quizPageStatus({ id: 3, status: 'published', has_unpublished_changes: true }).key).toBe('changes')
    expect(quizPageStatus({ id: 3, status: 'published', has_unpublished_changes: false }).key).toBe('published')
  })
})
