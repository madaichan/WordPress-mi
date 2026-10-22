import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useMasterDynamicDomains } from '../../../hooks/queries/useMasterAssetQueries.js'
import { AssetEditorLayout, BrowserPreview } from '../../assets/components/index.js'
import HtmlCodeEditor from '../../../components/Editor/HtmlCodeEditor.jsx'
import AlertConfirmation from '../../../components/UI/AlertConfirmation.jsx'
import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import Portal from '../../../components/UI/Portal.jsx'
import Tabs from '../../../components/UI/Tabs.jsx'
import { buildFigureHtml, buildStarterHtml, insertAtCursor, quizPageStatus } from '../../../utils/quizPageTemplate.js'

const VIEWS = [
  { key: 'code', label: 'HTML Code', icon: 'ti-code' },
  { key: 'preview', label: 'Live Preview', icon: 'ti-eye' },
]

/** Short, human wording for each linter problem code (docs/PRD_QUIZ_MODULE.md FR-6). */
const ISSUE_TONE = {
  missing_form: 'danger',
  key_without_input: 'danger',
  duplicate_input: 'danger',
  input_without_key: 'warning',
  unparsable_html: 'danger',
}

/**
 * The entity's single quiz page. Same editor shape as the education page
 * (EntityFlagPageEditor) — raw HTML with a live preview, a multi-select image
 * picker, and fullscreen editing — plus the two things only the quiz needs:
 * the linter report that stands between free-form HTML and gradable answers,
 * and the pass score / thank-you URL.
 *
 * The backend enforces scoping, the lock and the linter; `canEdit`/`canPublish`
 * only hide actions that would 403 anyway.
 */
export default function QuizPageEditor({
  page,
  questions = [],
  examples = [],
  requestExtras = {},
  canEdit: canEditProp = false,
  canPublish: canPublishProp = false,
  onDirtyChange,
  saveMutation,
  publishMutation,
  unpublishMutation,
  syncMutation,
}) {
  const [title, setTitle] = useState(page.title || '')
  const [html, setHtml] = useState(page.html_body || '')
  const [launchUrl, setLaunchUrl] = useState(page.launch_url || '')
  const [thankyouUrl, setThankyouUrl] = useState(page.thankyou_url || '')
  const [passScore, setPassScore] = useState(page.pass_score ?? '')
  const [view, setView] = useState('code')
  const [confirmingTemplate, setConfirmingTemplate] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [caret, setCaret] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [viewportH, setViewportH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800))

  // While fullscreen: track height, lock body scroll, and exit on Escape.
  useEffect(() => {
    if (!fullscreen) return undefined
    const onResize = () => setViewportH(window.innerHeight)
    const onKey = e => { if (e.key === 'Escape') setFullscreen(false) }
    onResize()
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [fullscreen])

  const busy = saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending || syncMutation.isPending

  // Locked while something that routes into this quiz is still running — a
  // simulation chained here directly, or one chained to the education page that
  // leads here. The backend enforces it (409 quiz_locked).
  const locked = page.editable === false
  const activeSimulations = page.active_simulations || []
  const canEdit = canEditProp && !locked
  const canPublish = canPublishProp && !locked

  const { data: domains = [] } = useMasterDynamicDomains()
  // Only "quiz"-type domains back the quiz campaign's launch URL.
  const launchUrlOptions = useMemo(
    () => domains
      .filter(d => d.type === 'quiz' && d.base_landing_url)
      .map(d => ({ url: d.base_landing_url, label: `${d.domain} (${d.base_landing_url})` })),
    [domains]
  )

  const dirty = title !== (page.title || '')
    || html !== (page.html_body || '')
    || launchUrl !== (page.launch_url || '')
    || thankyouUrl !== (page.thankyou_url || '')
    || String(passScore) !== String(page.pass_score ?? '')

  const status = quizPageStatus(page)
  const isPublished = page.status === 'published'
  const upToDate = isPublished && !dirty && !page.has_unpublished_changes
  const activeQuestions = useMemo(() => questions.filter(q => q.is_active !== false), [questions])

  // The linter report the server computed for the SAVED draft. While there are
  // unsaved edits it may be stale, which the UI says rather than hiding.
  const linter = page.linter || { ok: true, issues: [] }

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const groups = useMemo(() => {
    const map = new Map()
    examples.forEach(e => {
      const key = e.flag_id
      if (!map.has(key)) map.set(key, { flagId: key, label: e.flag_label || 'Flag', items: [] })
      map.get(key).items.push(e)
    })
    return [...map.values()]
  }, [examples])

  const draftPayload = () => ({
    ...requestExtras,
    title: title.trim(),
    html_body: html,
    launch_url: launchUrl,
    thankyou_url: thankyouUrl,
    pass_score: passScore === '' ? null : Number(passScore),
  })

  function validate() {
    if (!title.trim()) {
      toast.error('Template name is required.')
      return false
    }
    return true
  }

  function handleSave() {
    if (validate()) saveMutation.mutate({ data: draftPayload() })
  }

  function handleCancel() {
    setTitle(page.title || '')
    setHtml(page.html_body || '')
    setLaunchUrl(page.launch_url || '')
    setThankyouUrl(page.thankyou_url || '')
    setPassScore(page.pass_score ?? '')
  }

  // Publishing always publishes the SAVED draft, so unsaved edits go first.
  async function handlePublish() {
    if (!validate()) return
    if (!html.trim()) {
      toast.error('Add some content before publishing.')
      return
    }
    try {
      if (dirty || !page.id) await saveMutation.mutateAsync({ data: draftPayload() })
      await publishMutation.mutateAsync({ data: requestExtras })
    } catch {
      // The mutation hook toasts the error, including the linter refusal.
    }
  }

  function applyTemplate() {
    setHtml(buildStarterHtml(activeQuestions))
    if (!title.trim()) setTitle('Email Security Quiz')
    setConfirmingTemplate(false)
    toast.success(activeQuestions.length
      ? `Starter built from ${activeQuestions.length} active question(s).`
      : 'Starter inserted — add questions to the bank, then rebuild it.')
  }

  function toggleSelect(id) {
    setSelectedIds(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]))
  }

  function handleInsertSelected() {
    if (selectedIds.length === 0) return
    const byId = new Map(examples.map(e => [e.id, e]))
    const figures = selectedIds
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(e => buildFigureHtml({ src: e.image_url, caption: e.caption, alt: e.flag_label, flagExampleId: e.id }))
    if (figures.length === 0) return
    setHtml(current => insertAtCursor(current, figures.join('\n'), caret))
    setSelectedIds([])
    toast.success(figures.length === 1 ? 'Image inserted.' : `${figures.length} images inserted.`)
  }

  const starterButton = canEdit ? (
    <Button variant="outline" size="sm" onClick={() => (html.trim() ? setConfirmingTemplate(true) : applyTemplate())} disabled={busy}>
      <i className="ti ti-template text-sm" />
      <span>Use starter template</span>
    </Button>
  ) : null

  function renderWorkspace(height) {
    if (view === 'code') {
      return (
        <AssetEditorLayout fileName="quiz.html" lineCount={html.split('\n').length} lineCountLabel="baris">
          {canEdit
            ? <HtmlCodeEditor value={html} onChange={setHtml} onCaretChange={setCaret} height={height} />
            : <pre className="overflow-auto p-4 font-mono text-xs text-ink-soft" style={{ maxHeight: height }}>{html || 'No content yet.'}</pre>}
        </AssetEditorLayout>
      )
    }

    return (
      <div className="flex min-h-[450px] flex-col items-center justify-center overflow-x-auto rounded-xl border border-line bg-panel-muted p-6">
        {html.trim() ? (
          <BrowserPreview html={html} redirectUrl={thankyouUrl || 'thank-you page'} title="Quiz page preview" />
        ) : (
          <div className="space-y-2 py-12 text-center text-ink-faint">
            <i className="ti ti-eye-off text-3xl" />
            <p className="text-xs font-medium">Nothing to preview yet — add content in the HTML Code tab.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-6">
      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <i className="ti ti-lock mt-0.5 text-base" />
          <div>
            <span className="font-semibold">This page is locked</span>
            <span className="ml-1">
              until the campaigns leading into it are completed or stopped:{' '}
              {activeSimulations.map(s => `${s.name} (${s.status}${s.via === 'education' ? ', via education' : ''})`).join(', ') || '—'}.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{page.id ? `Edit: ${page.title || 'Quiz Page'}` : 'Create Quiz Page'}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            The page targets answer after the education page. Only the published version is shown to them, and its answer key is
            frozen at publish time.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={busy || !dirty} title={dirty ? 'Discard unsaved changes' : undefined}>Cancel</Button>
            <Button variant={canPublish ? 'outline' : 'primary'} onClick={handleSave} disabled={busy || !dirty}>
              {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
            </Button>
            {canPublish && (
              <Button variant="primary" onClick={handlePublish} disabled={busy || upToDate} title={upToDate ? 'The published version is up to date' : undefined}>
                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* TOP PANEL */}
      <div className="space-y-4 rounded-xl border border-line bg-panel p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block space-y-1 text-xs sm:col-span-2">
            <span className="font-semibold text-ink-soft">Template Name *</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Contoh: Kuis Keamanan Email"
              maxLength={255}
              disabled={!canEdit || busy}
              className={clsx('w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500', canEdit ? 'bg-panel' : 'bg-panel-subtle text-ink-muted')}
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-ink-soft">Pass score (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              value={passScore}
              onChange={e => setPassScore(e.target.value)}
              placeholder="70"
              disabled={!canEdit || busy}
              className={clsx('w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500', canEdit ? 'bg-panel' : 'bg-panel-subtle text-ink-muted')}
            />
            <span className="block text-[10px] text-ink-faint">Empty uses the global default. A campaign can override it.</span>
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-ink-soft">Launch URL (campaign quiz)</span>
            <select
              value={launchUrl}
              onChange={e => setLaunchUrl(e.target.value)}
              disabled={!canEdit || busy}
              className={clsx('w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500', canEdit ? 'bg-panel' : 'bg-panel-subtle text-ink-muted')}
            >
              <option value="">— Pilih URL —</option>
              {/* Keep a stale saved value selectable even if it's no longer listed. */}
              {launchUrl && !launchUrlOptions.some(o => o.url === launchUrl) && <option value={launchUrl}>{launchUrl}</option>}
              {launchUrlOptions.map(o => <option key={o.url} value={o.url}>{o.label}</option>)}
            </select>
            <span className="block text-[10px] text-ink-faint">Needs a domain typed “quiz”.</span>
          </label>

          <label className="block space-y-1 text-xs sm:col-span-2">
            <span className="font-semibold text-ink-soft">Thank-you URL</span>
            <input
              value={thankyouUrl}
              onChange={e => setThankyouUrl(e.target.value)}
              placeholder="https://intranet.perusahaan.co.id/terima-kasih"
              disabled={!canEdit || busy}
              className={clsx('w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500', canEdit ? 'bg-panel' : 'bg-panel-subtle text-ink-muted')}
            />
            <span className="block text-[10px] text-ink-faint">Where a target lands after submitting. The quiz ends the chain, so without this they stay on the form.</span>
          </label>
        </div>

        {/* Linter report */}
        <div className="space-y-2 rounded-lg border border-line-soft bg-panel-subtle p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink-soft">Answer check</span>
            {linter.ok
              ? <Badge tone="success">Every answer can be graded</Badge>
              : <Badge tone="danger">{linter.issues.length} problem(s) — publish blocked</Badge>}
            <span className="text-[11px] text-ink-faint">{page.answer_key_count || 0} active question(s) in the bank</span>
            {dirty && <span className="text-[11px] text-amber-700 dark:text-amber-400">Checked against the last saved draft — save to re-check.</span>}
          </div>
          {!linter.ok && (
            <ul className="space-y-1">
              {linter.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.input_name}-${index}`} className="flex items-start gap-2">
                  <i className={clsx('ti ti-alert-triangle mt-0.5 text-[13px]', ISSUE_TONE[issue.code] === 'warning' ? 'text-amber-600' : 'text-danger')} />
                  <span className="text-ink-soft">{issue.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {canEdit && (
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-ink-soft">Flags Images</span>
                <p className="text-[10px] text-ink-faint">Select the image (click order = insert order), place the cursor in the editor, then Insert.</p>
              </div>
              <Button variant="primary" size="sm" onClick={handleInsertSelected} disabled={busy || selectedIds.length === 0}>
                {`Insert at cursor${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
              </Button>
            </div>

            {groups.length === 0 ? (
              <p className="text-ink-faint">No example images yet — upload some in My Profile → Flags → Images.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {groups.map(group => (
                  <div key={group.flagId} className="w-28 flex-shrink-0 space-y-1.5">
                    <span className="block truncate text-[11px] font-semibold text-ink-muted" title={group.label}>{group.label}</span>
                    <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                      {group.items.map(example => {
                        const order = selectedIds.indexOf(example.id)
                        const selected = order !== -1
                        return (
                          <button
                            key={example.id}
                            type="button"
                            onClick={() => toggleSelect(example.id)}
                            disabled={busy}
                            title={example.caption || 'Select this image'}
                            className={clsx(
                              'group relative block h-16 w-full overflow-hidden rounded-lg border bg-panel-subtle disabled:opacity-60',
                              selected ? 'border-violet-500 ring-2 ring-violet-300' : 'border-line hover:border-violet-400'
                            )}
                          >
                            <img src={example.thumbnail_url} alt={example.caption || example.flag_label} className="h-full w-full object-cover" loading="lazy" />
                            {selected && (
                              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">{order + 1}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Status + GoPhish + chain */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-xs">
          <span className="font-semibold text-ink-muted">Status</span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {dirty && <span className="text-ink-muted">Unsaved changes</span>}
          {isPublished && (
            page.synced_at
              ? <Badge tone="info">GoPhish: synced</Badge>
              : <Badge tone="warning">GoPhish: not synced</Badge>
          )}
          {isPublished && page.gophish_master_id && <Badge tone="success">{`Quiz campaign #${page.gophish_master_id}`}</Badge>}
          {isPublished && page.published_pass_score != null && <Badge tone="gray">{`Graded at ${page.published_pass_score}%`}</Badge>}
          {canPublish && isPublished && (
            <button
              type="button"
              className="font-semibold text-violet-600 hover:underline disabled:opacity-60 dark:text-violet-400"
              onClick={() => syncMutation.mutate({ data: requestExtras })}
              disabled={busy}
              title="Push the published page to GoPhish again and refresh the quiz campaign"
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync to GoPhish'}
            </button>
          )}
          {canPublish && isPublished && (
            <button
              type="button"
              className="font-semibold text-danger hover:underline disabled:opacity-60"
              onClick={() => unpublishMutation.mutate({ data: requestExtras })}
              disabled={busy}
            >
              {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
            </button>
          )}
        </div>
      </div>

      {/* BOTTOM PANEL */}
      {!fullscreen && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs items={VIEWS} active={view} onChange={setView} variant="pill" />
            <div className="flex items-center gap-2">
              {starterButton}
              <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
                <i className="ti ti-maximize text-sm" />
                <span>Fullscreen</span>
              </Button>
            </div>
          </div>
          {renderWorkspace(420)}
        </div>
      )}

      {fullscreen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex flex-col bg-panel">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm font-semibold text-ink">{title || 'Quiz Page'}</span>
                <Tabs items={VIEWS} active={view} onChange={setView} variant="pill" />
              </div>
              <div className="flex items-center gap-2">
                {starterButton}
                {canEdit && selectedIds.length > 0 && (
                  <Button variant="primary" size="sm" onClick={handleInsertSelected} disabled={busy}>
                    {`Insert at cursor (${selectedIds.length})`}
                  </Button>
                )}
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleSave} disabled={busy || !dirty}>
                    {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setFullscreen(false)}>
                  <i className="ti ti-minimize text-sm" />
                  <span>Exit</span>
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {renderWorkspace(Math.max(320, viewportH - 150))}
            </div>
          </div>
        </Portal>
      )}

      {confirmingTemplate && (
        <AlertConfirmation
          title="Replace the current content?"
          message="The starter template is rebuilt from the active questions and will replace what is in the editor. Nothing is saved until you save the draft."
          icon="ti-template"
          tone="danger"
          confirmLabel="Replace"
          onCancel={() => setConfirmingTemplate(false)}
          onConfirm={applyTemplate}
        />
      )}
    </div>
  )
}
