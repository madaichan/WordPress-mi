import { useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import Drawer from '../../../components/UI/Drawer.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import Modal from '../../../components/UI/Modal.jsx'
import SearchInput from '../../../components/UI/SearchInput.jsx'
import Select from '../../../components/UI/Select.jsx'
import QuestionPreview from './QuestionPreview.jsx'

const BLANK = {
  question: '',
  input_name: '',
  explanation: '',
  difficulty: 1,
  tags: '',
  is_active: true,
  options: [
    { label: '', value: '', correct: false },
    { label: '', value: '', correct: false },
  ],
}

/**
 * The entity's question bank (docs/PRD_QUIZ_MODULE.md FR-2).
 *
 * `input_name` is the field that matters most here: it is the only link
 * between a question's answer key and an input in the free-form page HTML, so
 * it is shown on every row and explained in the form. The backend enforces the
 * pattern and uniqueness; this only keeps the operator informed.
 *
 * A container by design — it owns the drawer's local form state and calls the
 * mutations the page hands it.
 */
export default function QuestionBankPanel({ questions = [], canManage = false, busy = false, onCreate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [previewing, setPreviewing] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [difficulty, setDifficulty] = useState('all')
  const [tag, setTag] = useState('all')

  // Tags for the filter dropdown, flattened from every question's CSV tags.
  const allTags = useMemo(() => {
    const set = new Set()
    questions.forEach(q => String(q.tags || '').split(',').forEach(t => {
      const trimmed = t.trim()
      if (trimmed) set.add(trimmed)
    }))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [questions])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return questions.filter(q => {
      if (status === 'active' && q.is_active === false) return false
      if (status === 'inactive' && q.is_active !== false) return false
      if (difficulty !== 'all' && String(q.difficulty || 1) !== difficulty) return false
      if (tag !== 'all' && !String(q.tags || '').split(',').map(t => t.trim()).includes(tag)) return false
      if (term) {
        const haystack = `${q.question || ''} ${q.input_name || ''} ${q.tags || ''}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [questions, search, status, difficulty, tag])

  const filtersActive = Boolean(search.trim()) || status !== 'all' || difficulty !== 'all' || tag !== 'all'

  const openNew = () => setEditing({ ...BLANK, options: BLANK.options.map(o => ({ ...o })) })
  const openEdit = (question) => setEditing({
    id: question.id,
    question: question.question || '',
    input_name: question.input_name || '',
    explanation: question.explanation || '',
    difficulty: question.difficulty || 1,
    tags: question.tags || '',
    is_active: question.is_active !== false,
    options: (question.options || []).map(o => ({ label: o.label || '', value: o.value || '', correct: Boolean(o.correct) })),
  })

  const suggestedInputName = `answer_q${questions.length + 1}`

  function submit() {
    const form = editing
    if (!form.question.trim()) { toast.error('The question text is required.'); return }
    const options = form.options
      .filter(o => String(o.value).trim() !== '')
      .map(o => ({ label: o.label.trim() || o.value.trim(), value: o.value.trim(), correct: Boolean(o.correct) }))
    if (options.length < 2) { toast.error('A question needs at least two answer options.'); return }
    if (!options.some(o => o.correct)) { toast.error('Mark at least one option as correct.'); return }

    const data = {
      question: form.question.trim(),
      input_name: (form.input_name.trim() || suggestedInputName).toLowerCase(),
      explanation: form.explanation.trim(),
      difficulty: Number(form.difficulty) || 1,
      tags: form.tags.trim(),
      is_active: Boolean(form.is_active),
      options,
    }

    const done = () => setEditing(null)
    if (form.id) onUpdate?.({ id: form.id, data }, done)
    else onCreate?.(data, done)
  }

  function patchOption(index, patch) {
    setEditing(f => ({ ...f, options: f.options.map((o, i) => (i === index ? { ...o, ...patch } : o)) }))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs text-ink-muted">
          Each question owns an <span className="font-mono text-ink-soft">input_name</span>. The quiz page HTML must use that exact
          name on its input, or publishing is refused because the answer could not be graded.
        </p>
        {canManage && (
          <Button variant="primary" size="sm" onClick={openNew} disabled={busy}>
            <i className="ti ti-plus text-sm" />
            <span>Add question</span>
          </Button>
        )}
      </div>

      {questions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search questions, input_name, tags…" wrapperClassName="relative w-full max-w-sm" />
          <Select value={status} onChange={e => setStatus(e.target.value)} className="w-auto min-w-[8rem]">
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-auto min-w-[9rem]">
            <option value="all">All difficulty</option>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={String(n)}>Difficulty {n}</option>)}
          </Select>
          {allTags.length > 0 && (
            <Select value={tag} onChange={e => setTag(e.target.value)} className="w-auto min-w-[8rem]">
              <option value="all">All tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          )}
          <span className="ml-auto text-[11px] text-ink-faint">{filtered.length} of {questions.length}</span>
          {filtersActive && (
            <button type="button" onClick={() => { setSearch(''); setStatus('all'); setDifficulty('all'); setTag('all') }} className="text-[11px] text-violet-600 hover:underline dark:text-violet-400">
              Clear
            </button>
          )}
        </div>
      )}

      {questions.length === 0 ? (
        <EmptyState
          icon="ti-help-circle"
          title="No questions yet"
          description={canManage ? 'Add the questions this entity should ask after its education page.' : 'This entity has not added any quiz questions yet.'}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="ti-search-off"
          title="No matching questions"
          description="No question matches the current search and filters."
        />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {filtered.map(question => (
            <div key={question.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-panel-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">{question.input_name}</span>
                  {question.is_active === false && <Badge tone="gray">Inactive</Badge>}
                  <span className="text-[11px] text-ink-faint">
                    {question.options?.length || 0} options · {question.correct_count || 0} correct · difficulty {question.difficulty}
                  </span>
                </div>
                <p className="text-sm text-ink">{question.question}</p>
                {question.tags && <p className="text-[11px] text-ink-faint">Tags: {question.tags}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPreviewing(question)} title="Preview this question">
                  <i className="ti ti-eye text-sm" />
                </Button>
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openEdit(question)} disabled={busy}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => onDelete?.(question)} disabled={busy}>
                      <i className="ti ti-trash text-sm text-danger" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          onClose={() => setEditing(null)}
          title={editing.id ? 'Edit question' : 'Add question'}
          footer={(
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
              <Button variant="primary" onClick={submit} disabled={busy}>{editing.id ? 'Save question' : 'Add question'}</Button>
            </div>
          )}
        >
          <div className="space-y-4 text-xs">
            <label className="block space-y-1">
              <span className="font-semibold text-ink-soft">Question *</span>
              <textarea
                value={editing.question}
                onChange={e => setEditing(f => ({ ...f, question: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
                placeholder="Contoh: Email mendesak minta ganti password, apa tindakan paling aman?"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-semibold text-ink-soft">Input name</span>
              <input
                value={editing.input_name}
                onChange={e => setEditing(f => ({ ...f, input_name: e.target.value }))}
                placeholder={suggestedInputName}
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 font-mono text-sm text-ink outline-none focus:border-violet-500"
              />
              <span className="block text-[10px] text-ink-faint">
                Lowercase letters, numbers and underscores after <span className="font-mono">answer_</span>. Must be unique in this entity, and must
                match the input name used in the page HTML.
              </span>
            </label>

            <div className="space-y-2">
              <span className="font-semibold text-ink-soft">Answer options *</span>
              {editing.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={option.label}
                    onChange={e => patchOption(index, { label: e.target.value })}
                    placeholder="Label shown to the target"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-violet-500"
                  />
                  <input
                    value={option.value}
                    onChange={e => patchOption(index, { value: e.target.value })}
                    placeholder="value"
                    className="w-24 rounded-lg border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-violet-500"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-ink-soft" title="Mark as a correct answer">
                    <input type="checkbox" checked={option.correct} onChange={e => patchOption(index, { correct: e.target.checked })} />
                    correct
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditing(f => ({ ...f, options: f.options.filter((_, i) => i !== index) }))}
                    className="text-ink-faint hover:text-danger"
                    title="Remove this option"
                  >
                    <i className="ti ti-x text-sm" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(f => ({ ...f, options: [...f.options, { label: '', value: '', correct: false }] }))}
                disabled={editing.options.length >= 10}
              >
                <i className="ti ti-plus text-sm" />
                <span>Add option</span>
              </Button>
              <p className="text-[10px] text-ink-faint">
                The <span className="font-mono">value</span> is what GoPhish captures, so it must match the value attribute in the page HTML. Several
                options may be correct — the answer is then graded as a set.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold text-ink-soft">Explanation</span>
              <textarea
                value={editing.explanation}
                onChange={e => setEditing(f => ({ ...f, explanation: e.target.value }))}
                rows={2}
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
                placeholder="Internal note — not shown to the target."
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="font-semibold text-ink-soft">Difficulty</span>
                <select
                  value={editing.difficulty}
                  onChange={e => setEditing(f => ({ ...f, difficulty: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
                >
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-ink-soft">Tags</span>
                <input
                  value={editing.tags}
                  onChange={e => setEditing(f => ({ ...f, tags: e.target.value }))}
                  placeholder="phishing, attachment"
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
                />
              </label>
            </div>

            <label className={clsx('flex items-center gap-2', editing.is_active ? 'text-ink-soft' : 'text-ink-muted')}>
              <input type="checkbox" checked={editing.is_active} onChange={e => setEditing(f => ({ ...f, is_active: e.target.checked }))} />
              <span>Active — inactive questions are left out of the answer key and the starter template</span>
            </label>
          </div>
        </Drawer>
      )}

      {previewing && (
        <Modal
          open
          onClose={() => setPreviewing(null)}
          title="Question preview"
          subtitle="How this question appears to a target"
        >
          <QuestionPreview question={previewing} />
        </Modal>
      )}
    </div>
  )
}
