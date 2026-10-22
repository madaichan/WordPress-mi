import { useEffect, useMemo, useState } from 'react'
import { useMasterDynamicDomains } from '../../../hooks/queries/useMasterAssetQueries.js'
import { useQuizPagePreview } from '../../../hooks/queries/useQuizQueries.js'
import { BrowserPreview } from '../../assets/components/index.js'
import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import Modal from '../../../components/UI/Modal.jsx'
import Select from '../../../components/UI/Select.jsx'

/** Short, human wording for each linter problem code (docs/PRD_QUIZ_MODULE.md FR-6). */
const ISSUE_TONE = {
  missing_form: 'danger',
  key_without_input: 'danger',
  duplicate_input: 'danger',
  input_without_key: 'warning',
  unparsable_html: 'danger',
}

/**
 * The no-code quiz builder (docs/PRD_QUIZ_MODULE.md §13). The operator picks a
 * template, fills its placeholders, and chooses which bank questions appear and
 * in what order; the server generates the page HTML. The raw HTML is never
 * edited here — that is what sets v2 apart from the legacy QuizPageEditor.
 *
 * A container by design: it owns the builder's form state and calls the
 * mutations the page hands it. Backend enforces scoping, the lock and the
 * linter; `canEdit`/`canPublish` only hide actions that would 403.
 */
export default function QuizBuilder({
  page,
  templates = [],
  questions = [],
  canEdit = false,
  canPublish = false,
  onBack,
  saveMutation,
  publishMutation,
  unpublishMutation,
  syncMutation,
}) {
  const [title, setTitle] = useState(page.title || '')
  const [templateId, setTemplateId] = useState(page.template_id || '')
  const [fieldValues, setFieldValues] = useState(() => ({ ...(page.field_values || {}) }))
  const [selectedIds, setSelectedIds] = useState(() => (page.selected_question_ids || []).map(Number))
  const [launchUrl, setLaunchUrl] = useState(page.launch_url || '')
  const [thankyouUrl, setThankyouUrl] = useState(page.thankyou_url || '')
  const [passScore, setPassScore] = useState(page.pass_score ?? '')
  const [preview, setPreview] = useState(false)

  const { data: domainsData } = useMasterDynamicDomains()
  const quizDomains = useMemo(
    () => (domainsData?.domains || domainsData || []).filter(d => d.type === 'quiz'),
    [domainsData],
  )

  // Live preview: debounce the builder inputs, then generate the page server-
  // side (single source of truth, no JS duplication of the generator) so the
  // right panel updates as questions and text are added — without saving.
  const previewInput = useMemo(() => ({
    entity: page.entity_name,
    template_id: templateId ? Number(templateId) : 0,
    field_values: fieldValues,
    selected_question_ids: selectedIds,
  }), [page.entity_name, templateId, fieldValues, selectedIds])
  const [debouncedInput, setDebouncedInput] = useState(previewInput)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(previewInput), 400)
    return () => clearTimeout(t)
  }, [previewInput])
  const { data: previewData, isFetching: previewFetching } = useQuizPagePreview(debouncedInput, { enabled: Boolean(templateId) })
  const previewHtml = previewData?.html || (Number(debouncedInput.template_id) === Number(page.template_id) ? page.html_body : '')

  const activeQuestions = useMemo(() => questions.filter(q => q.is_active !== false), [questions])
  const questionsById = useMemo(() => new Map(activeQuestions.map(q => [Number(q.id), q])), [activeQuestions])
  const template = templates.find(t => Number(t.id) === Number(templateId)) || null
  const placeholders = template?.placeholders || []

  const isPublished = page.status === 'published'
  const busy = saveMutation?.isPending || publishMutation?.isPending || unpublishMutation?.isPending || syncMutation?.isPending
  const linter = page.linter
  const locked = page.editable === false

  const buildData = () => ({
    id: page.id || undefined,
    title: title.trim(),
    template_id: templateId ? Number(templateId) : '',
    field_values: fieldValues,
    selected_question_ids: selectedIds,
    launch_url: launchUrl,
    thankyou_url: thankyouUrl,
    pass_score: passScore === '' ? null : Number(passScore),
  })

  const save = () => saveMutation?.mutate({ data: buildData() })
  const publish = () => publishMutation?.mutate({ data: { id: page.id } })
  const unpublish = () => unpublishMutation?.mutate({ data: { id: page.id } })
  const sync = () => syncMutation?.mutate({ data: { id: page.id } })

  function toggleQuestion(id) {
    const n = Number(id)
    setSelectedIds(prev => (prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]))
  }
  function move(index, delta) {
    setSelectedIds(prev => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <i className="ti ti-arrow-left text-sm" />
            <span>Back</span>
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-ink">{page.id ? 'Edit quiz' : 'New quiz'}</h3>
            <div className="flex items-center gap-2 text-[11px] text-ink-faint">
              <Badge tone={isPublished ? 'success' : 'gray'}>{isPublished ? 'Published' : 'Draft'}</Badge>
              {page.is_default_followup && <Badge tone="violet">Default follow-up</Badge>}
              {page.has_unpublished_changes && <span>· unpublished changes</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(true)} disabled={!previewHtml} title={previewHtml ? 'Open the preview full-screen' : 'Pick a template and add questions first'}>
            <i className="ti ti-arrows-maximize text-sm" />
            <span>Fullscreen</span>
          </Button>
          {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={save} disabled={busy || locked}>Save draft</Button>
            {canPublish && !isPublished && <Button variant="primary" size="sm" onClick={publish} disabled={busy || locked}>Publish</Button>}
            {canPublish && isPublished && (
              <>
                <Button variant="primary" size="sm" onClick={publish} disabled={busy || locked}>Re-publish</Button>
                <Button variant="outline" size="sm" onClick={unpublish} disabled={busy || locked}>Unpublish</Button>
              </>
            )}
          </>
          )}
        </div>
      </div>

      {locked && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-ink-soft">
          This quiz is locked because a related simulation is still active. Save, publish and unpublish are refused until it completes.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Builder form */}
        <div className="space-y-4 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold text-ink-soft">Quiz name *</span>
            <input value={title} onChange={e => setTitle(e.target.value)} disabled={!canEdit}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
              placeholder="e.g. Email Security Quiz" />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold text-ink-soft">Template *</span>
            <Select value={templateId} onChange={e => setTemplateId(e.target.value)} disabled={!canEdit}>
              <option value="">Choose a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            {template?.description && <span className="block text-[10px] text-ink-faint">{template.description}</span>}
          </label>

          {placeholders.length > 0 && (
            <div className="space-y-2 rounded-lg border border-line bg-panel-subtle/40 p-3">
              <span className="font-semibold text-ink-soft">Template fields</span>
              {placeholders.map(ph => (
                <label key={ph.key} className="block space-y-1">
                  <span className="text-[11px] text-ink-muted">{ph.label || ph.key}{ph.required && ' *'}</span>
                  {ph.type === 'textarea' ? (
                    <textarea
                      value={fieldValues[ph.key] || ''}
                      onChange={e => setFieldValues(v => ({ ...v, [ph.key]: e.target.value }))}
                      disabled={!canEdit}
                      rows={2}
                      className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
                    />
                  ) : (
                    <input
                      value={fieldValues[ph.key] || ''}
                      onChange={e => setFieldValues(v => ({ ...v, [ph.key]: e.target.value }))}
                      disabled={!canEdit}
                      className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500"
                    />
                  )}
                </label>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <span className="font-semibold text-ink-soft">Questions ({selectedIds.length} selected)</span>
            {activeQuestions.length === 0 ? (
              <p className="text-[11px] text-ink-faint">No active questions in the bank. Add some in the Question Bank tab first.</p>
            ) : (
              <>
                {/* Chosen, in display order */}
                {selectedIds.length > 0 && (
                  <ol className="space-y-1">
                    {selectedIds.map((id, index) => {
                      const q = questionsById.get(id)
                      if (!q) return null
                      return (
                        <li key={id} className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2 py-1.5">
                          <span className="font-mono text-[10px] text-ink-faint">{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{q.question}</span>
                          {canEdit && (
                            <span className="flex items-center gap-1">
                              <button type="button" onClick={() => move(index, -1)} className="text-ink-faint hover:text-ink" title="Move up"><i className="ti ti-chevron-up text-sm" /></button>
                              <button type="button" onClick={() => move(index, 1)} className="text-ink-faint hover:text-ink" title="Move down"><i className="ti ti-chevron-down text-sm" /></button>
                              <button type="button" onClick={() => toggleQuestion(id)} className="text-ink-faint hover:text-danger" title="Remove"><i className="ti ti-x text-sm" /></button>
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
                {/* Available to add */}
                {canEdit && (
                  <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-line p-2">
                    {activeQuestions.filter(q => !selectedIds.includes(Number(q.id))).map(q => (
                      <button key={q.id} type="button" onClick={() => toggleQuestion(q.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] text-ink-soft hover:bg-panel-subtle">
                        <i className="ti ti-plus text-xs text-ink-faint" />
                        <span className="min-w-0 flex-1 truncate">{q.question}</span>
                        <span className="font-mono text-[10px] text-ink-faint">{q.input_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="font-semibold text-ink-soft">Launch URL</span>
              <Select value={launchUrl} onChange={e => setLaunchUrl(e.target.value)} disabled={!canEdit}>
                <option value="">Choose a quiz domain…</option>
                {quizDomains.map(d => <option key={d.id} value={d.base_landing_url}>{d.base_landing_url}</option>)}
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-ink-soft">Pass score (%)</span>
              <input type="number" min="0" max="100" value={passScore} onChange={e => setPassScore(e.target.value)} disabled={!canEdit}
                placeholder="entity / global default"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500" />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-semibold text-ink-soft">Thank-you URL</span>
            <input value={thankyouUrl} onChange={e => setThankyouUrl(e.target.value)} disabled={!canEdit}
              placeholder="https://intranet.example/thanks"
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500" />
          </label>

          {/* Status: linter + GoPhish + chain */}
          <div className="space-y-2 rounded-lg border border-line bg-panel p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-soft">Status</span>
              {isPublished && canPublish && <Button variant="outline" size="sm" onClick={sync} disabled={busy}>Re-sync GoPhish</Button>}
            </div>
            {linter && (
              linter.ok
                ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400"><i className="ti ti-check" /> Linter: the page can be graded.</p>
                : (
                  <ul className="space-y-1">
                    {(linter.issues || []).map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px]">
                        <Badge tone={ISSUE_TONE[issue.code] || 'gray'}>{issue.input_name || issue.code}</Badge>
                        <span className="text-ink-muted">{issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )
            )}
            {page.gophish_master_id && <p className="text-[11px] text-ink-faint">GoPhish master #{page.gophish_master_id}{page.synced_at ? ` · synced ${page.synced_at}` : ''}</p>}
          </div>
        </div>

        {/* Live preview: regenerates as the builder inputs change */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-soft">Live preview</span>
            {previewFetching && <span className="text-[11px] text-ink-faint">updating…</span>}
          </div>
          {previewHtml
            ? <BrowserPreview html={previewHtml} redirectUrl={thankyouUrl} title="Quiz preview" />
            : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line bg-panel-subtle/40 px-6 text-center text-xs text-ink-faint">
                {templateId
                  ? 'Add at least one question to see the quiz page here.'
                  : 'Pick a template to start previewing the quiz page.'}
              </div>
            )}
        </div>
      </div>

      {preview && (
        <Modal
          open
          onClose={() => setPreview(false)}
          title="Quiz page preview"
          subtitle={page.title || 'Generated quiz page'}
          className="max-w-5xl"
        >
          {previewHtml
            ? <BrowserPreview html={previewHtml} redirectUrl={thankyouUrl} title="Quiz preview" />
            : <p className="text-sm text-ink-faint">Pick a template and add questions to preview the page.</p>}
        </Modal>
      )}
    </div>
  )
}
