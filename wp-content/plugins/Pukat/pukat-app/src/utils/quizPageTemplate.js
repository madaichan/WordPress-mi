// Pure helpers for the Quiz page editor (docs/PRD_QUIZ_MODULE.md FR-4).
//
// The starter is generated from the entity's question bank so the operator
// never types an input name by hand — that name is the only link between a
// question's answer key and the free-form HTML, and the linter blocks a
// publish when the two disagree (FR-6).

import { escapeHtml, insertAtCursor, buildFigureHtml } from './flagPageTemplate.js'

// Re-exported so the quiz editor imports one module; the Flag page editor
// already owns these and they are identical for both pages.
export { escapeHtml, insertAtCursor, buildFigureHtml }

/** Status shown in the editor header. `page` is the full page payload. */
export function quizPageStatus(page) {
  if (!page || !page.id) return { key: 'none', label: 'No page', tone: 'gray' }
  if (page.status !== 'published') return { key: 'draft', label: 'Draft', tone: 'gray' }
  if (page.has_unpublished_changes) return { key: 'changes', label: 'Unpublished changes', tone: 'warning' }
  return { key: 'published', label: 'Published', tone: 'success' }
}

/**
 * One question block. Both languages share a single set of inputs on purpose:
 * duplicating the block (name attribute included) for the English copy is what
 * the linter reports as `duplicate_input`, so the starter must not model that.
 * The `<fieldset>` is what lets the linter tell "one radio group" apart from
 * "the same name used twice".
 */
function questionBlock(question, index) {
  const number = index + 1
  const inputName = escapeHtml(question?.input_name || `answer_q${number}`)
  const text = escapeHtml(question?.question || '')
  const options = Array.isArray(question?.options) ? question.options : []

  const choices = options.map(option => {
    const value = escapeHtml(option?.value ?? '')
    const label = escapeHtml(option?.label ?? option?.value ?? '')
    return [
      '                    <label class="choice">',
      `                        <input type="radio" name="${inputName}" value="${value}" required />`,
      `                        <span class="only-id">${label}</span>`,
      `                        <span class="only-en">[EN] ${label}</span>`,
      '                    </label>',
    ].join('\n')
  }).join('\n')

  return [
    '                <fieldset class="question">',
    `                    <legend><span class="q-number">${number}</span></legend>`,
    '                    <p class="q-text">',
    `                        <span class="only-id">${text}</span>`,
    `                        <span class="only-en">[EN] Translate this question.</span>`,
    '                    </p>',
    choices,
    '                </fieldset>',
  ].join('\n')
}

/**
 * The starter quiz page: bilingual ID/EN with a language toggle, one fieldset
 * per active question, a POST form, and the GoPhish `{{.RId}}` hidden field.
 *
 * `{{.RId}}` must stay a template token — GoPhish fills it per target, and
 * hardcoding it breaks the link between a submission and a person.
 */
export function buildStarterHtml(questions = []) {
  const list = Array.isArray(questions) ? questions : []
  const blocks = list.length
    ? list.map(questionBlock).join('\n\n')
    : [
      '                <!-- Belum ada soal aktif di bank. Tambahkan soal di tab Question Bank, lalu buat ulang starter ini. -->',
      '                <!-- No active questions in the bank yet. Add questions in the Question Bank tab, then regenerate this starter. -->',
    ].join('\n')

  return `<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kuis Keamanan Email / Email Security Quiz</title>
    <style type="text/css">
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background-color: #f4f6f9;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 760px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
            padding: 30px;
        }

        .lang-switch {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 16px;
        }

        .lang-switch button {
            border: 1px solid #cbd5e1;
            background: #fff;
            color: #475569;
            padding: 6px 14px;
            border-radius: 20px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
        }

        .lang-switch button.active {
            background: #2563eb;
            color: #fff;
            border-color: #2563eb;
        }

        h1 {
            color: #1e293b;
            font-size: 24px;
            margin-bottom: 8px;
        }

        .subtitle {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 24px;
        }

        fieldset.question {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 18px 20px;
            margin-bottom: 16px;
        }

        fieldset.question legend {
            padding: 0 8px;
        }

        .q-number {
            display: inline-block;
            background: #2563eb;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            border-radius: 999px;
            padding: 2px 10px;
        }

        .q-text {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 12px;
        }

        label.choice {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
            font-size: 14px;
        }

        label.choice:hover {
            background: #f8fafc;
        }

        .submit-row {
            margin-top: 24px;
        }

        button.submit {
            background: #2563eb;
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 12px 28px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
        }

        .note {
            color: #94a3b8;
            font-size: 12px;
            margin-top: 12px;
        }

        body.lang-id .only-en {
            display: none;
        }

        body.lang-en .only-id {
            display: none;
        }
    </style>
</head>

<body class="lang-id">
    <div class="container">
        <div class="lang-switch">
            <button id="btn-id" onclick="setLang('id')" type="button">Bahasa Indonesia</button>
            <button id="btn-en" onclick="setLang('en')" type="button">English</button>
        </div>

        <h1>
            <span class="only-id">Kuis Keamanan Email</span>
            <span class="only-en">Email Security Quiz</span>
        </h1>
        <p class="subtitle">
            <span class="only-id">Jawab pertanyaan berikut berdasarkan materi edukasi yang baru Anda baca.</span>
            <span class="only-en">Answer the questions below based on the training material you just read.</span>
        </p>

        <form method="post">
            <input id="rid-field" name="rid" type="hidden" value="{{.RId}}" />
            <input id="lang-field" name="lang" type="hidden" value="id" />

${blocks}

            <div class="submit-row">
                <button class="submit" type="submit">
                    <span class="only-id">Kirim Jawaban</span>
                    <span class="only-en">Submit Answers</span>
                </button>
                <p class="note">
                    <span class="only-id">Jawaban Anda dipakai untuk mengukur efektivitas materi, bukan untuk menilai individu.</span>
                    <span class="only-en">Your answers measure how effective the material was, not individual performance.</span>
                </p>
            </div>
        </form>
    </div>

    <script>
        function setLang(lang) {
            document.body.className = 'lang-' + lang;
            document.documentElement.lang = lang;
            var field = document.getElementById('lang-field');
            if (field) { field.value = lang; }
            var bId = document.getElementById('btn-id');
            var bEn = document.getElementById('btn-en');
            if (bId) { bId.classList.toggle('active', lang === 'id'); }
            if (bEn) { bEn.classList.toggle('active', lang === 'en'); }
        }
        // Default to Indonesian.
        setLang('id');
    </script>
</body>

</html>
`
}
