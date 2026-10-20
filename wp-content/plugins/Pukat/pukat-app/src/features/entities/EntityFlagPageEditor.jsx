import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useFlagPage } from '../../hooks/queries/useFlagQueries.js'
import { usePublishFlagPageMutation, useSaveFlagPageMutation, useSyncFlagPageMutation, useUnpublishFlagPageMutation } from '../../hooks/mutations/useFlagMutations.js'
import { useMasterDynamicDomains } from '../../hooks/queries/useMasterAssetQueries.js'
import { AssetEditorLayout, BrowserPreview } from '../assets/components/index.js'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import Portal from '../../components/UI/Portal.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import { buildFigureHtml, buildStarterHtml, flagPageStatus, insertAtCursor } from '../../utils/flagPageTemplate.js'

const VIEWS = [
  { key: 'code', label: 'HTML Code', icon: 'ti-code' },
  { key: 'preview', label: 'Live Preview', icon: 'ti-eye' },
]

/**
 * The entity's single education page (docs/PRD_FLAG_EDUCATION_PAGES.md — one
 * page per entity, not per category). Laid out per
 * docs/prototypes/education-page-tab.txt: a top panel (template name + a
 * multi-select image picker grouped by Flag category) over a bottom panel
 * whose HTML Code / Live Preview sub-tabs share one draft. Inserted images
 * carry a `data-pukat-img` identity and keep a plain URL in `src`; base64 is
 * substituted only on export/sync (FR-6b). The backend enforces scoping and
 * permissions — `canEdit`/`canPublish` only hide actions that would 403.
 */
export default function EntityFlagPageEditor({ examples = [], adminEntity = null, canEdit = false, canPublish = false, onDirtyChange }) {
  const params = useMemo(() => (adminEntity ? { entity: adminEntity } : {}), [adminEntity])
  const { data: page, isLoading, isError, error } = useFlagPage(params)

  if (isLoading) return <p className="text-sm text-ink-faint">Loading...</p>
  if (isError || !page) return <p className="text-sm text-danger">{error?.message || 'Could not load the education page.'}</p>

  // Keyed by entity so switching entities (admin) starts from that page's draft.
  return (
    <PageForm
      key={adminEntity || 'self'}
      page={page}
      examples={examples}
      requestExtras={params}
      canEdit={canEdit}
      canPublish={canPublish}
      onDirtyChange={onDirtyChange}
    />
  )
}

function PageForm({ page, examples, requestExtras, canEdit: canEditProp, canPublish: canPublishProp, onDirtyChange }) {
  const [title, setTitle] = useState(page.title || '')
  const [html, setHtml] = useState(page.html_body || '')
  const [launchUrl, setLaunchUrl] = useState(page.launch_url || '')
  const [view, setView] = useState('code')
  const [confirmingTemplate, setConfirmingTemplate] = useState(false)
  // Ordered multi-select for the image picker; `caret` is the last known
  // cursor position in the code editor (null = unknown → insert at the end).
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

  const saveMutation = useSaveFlagPageMutation()
  const publishMutation = usePublishFlagPageMutation()
  const unpublishMutation = useUnpublishFlagPageMutation()
  const syncMutation = useSyncFlagPageMutation()
  const busy = saveMutation.isPending || publishMutation.isPending || unpublishMutation.isPending || syncMutation.isPending

  // Locked while a related simulation is active (backend enforces too). The
  // effective canEdit/canPublish fold the lock in, so every control below
  // disables automatically.
  const locked = page.editable === false
  const activeSimulations = page.active_simulations || []
  const canEdit = canEditProp && !locked
  const canPublish = canPublishProp && !locked

  const { data: domains = [] } = useMasterDynamicDomains()
  // Only "education"-type domains back the education campaign's launch URL.
  const launchUrlOptions = useMemo(
    () => domains
      .filter(d => d.type === 'education' && d.base_landing_url)
      .map(d => ({ url: d.base_landing_url, label: `${d.domain} (${d.base_landing_url})` })),
    [domains]
  )

  const dirty = title !== (page.title || '') || html !== (page.html_body || '') || launchUrl !== (page.launch_url || '')
  const status = flagPageStatus(page)
  const isPublished = page.status === 'published'
  const upToDate = isPublished && !dirty && !page.has_unpublished_changes

  // Examples grouped by Flag category, for the picker.
  const groups = useMemo(() => {
    const map = new Map()
    examples.forEach(e => {
      const key = e.flag_id
      if (!map.has(key)) map.set(key, { flagId: key, label: e.flag_label || 'Flag', items: [] })
      map.get(key).items.push(e)
    })
    return [...map.values()]
  }, [examples])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const draftPayload = () => ({ ...requestExtras, title: title.trim(), html_body: html, launch_url: launchUrl })

  function validate() {
    if (!title.trim()) {
      toast.error('Nama template is required.')
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
  }

  // Publishing always publishes the saved draft, so unsaved edits are saved first.
  async function handlePublish() {
    if (!validate()) return
    if (!html.trim()) {
      toast.error('Add some content before publishing.')
      return
    }
    try {
      if (dirty || !page.id) await saveMutation.mutateAsync({ data: draftPayload() })
      const published = await publishMutation.mutateAsync({ data: requestExtras })
      // Publish also pushes to GoPhish (landing page + education master); warn
      // if only those parts failed — the local publish still succeeded.
      if (published?.sync && published.sync.ok === false) {
        toast.error(`Published, but GoPhish sync failed: ${published.sync.message}`)
      } else if (published?.master && published.master.ok === false && published.master.message) {
        toast.error(`Published & synced, but education campaign failed: ${published.master.message}`)
      }
    } catch {
      // The mutation hooks already toast the error.
    }
  }

  function applyTemplate() {
    setHtml(buildStarterHtml())
    if (!title.trim()) setTitle('Flag Email Security Education')
    setConfirmingTemplate(false)
  }

  function toggleSelect(id) {
    setSelectedIds(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]))
  }

  // Insert the selected images (in click order) at the cursor. The draft keeps
  // a URL src plus the data-pukat-img identity; base64 happens only on export.
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

  // Code editor or live preview, sized to `height` (reused inline and fullscreen).
  function renderWorkspace(height) {
    if (view === 'code') {
      return (
        <AssetEditorLayout fileName="template.html" lineCount={html.split('\n').length} lineCountLabel="baris">
          {canEdit
            ? <HtmlCodeEditor value={html} onChange={setHtml} onCaretChange={setCaret} height={height} />
            : <pre className="overflow-auto p-4 font-mono text-xs text-ink-soft" style={{ maxHeight: height }}>{html || 'No content yet.'}</pre>}
        </AssetEditorLayout>
      )
    }

    return (
      <div className="flex min-h-[450px] flex-col items-center justify-center overflow-x-auto rounded-xl border border-line bg-panel-muted p-6">
        {html.trim() ? (
          <BrowserPreview html={html} redirectUrl="education page" title="Education page preview" />
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
    <div className="space-y-6 animate-fade-in">
      {locked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <i className="ti ti-lock mt-0.5 text-base" />
          <div>
            <span className="font-semibold">This page is locked</span>
            <span className="ml-1">for editing until the next simulation has been completed or stopped: {activeSimulations.map(s => `${s.name} (${s.status})`).join(', ') || '—'}.</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{page.id ? `Edit: ${page.title || 'Education Page'}` : 'Create Education Page'}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">The HTML page your colleagues see after a simulation. Only the published version is shown to them.</p>
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

      {/* TOP PANEL: template name + image picker */}
      <div className="space-y-4 rounded-xl border border-line bg-panel p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-ink-soft">Template Name *</span>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Contoh: Flag Education"
              maxLength={255}
              disabled={!canEdit || busy}
              className={clsx('w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500', canEdit ? 'bg-panel' : 'bg-panel-subtle text-ink-muted')}
            />
          </label>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-ink-soft">Launch URL (campaign education)</span>
            <select
              value={launchUrl}
              onChange={e => setLaunchUrl(e.target.value)}
              disabled={!canEdit || busy}
              className={clsx('w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-violet-500', canEdit ? 'bg-panel' : 'bg-panel-subtle text-ink-muted')}
            >
              <option value="">— Pilih URL —</option>
              {/* Keep a stale saved value selectable even if it's no longer in the list. */}
              {launchUrl && !launchUrlOptions.some(o => o.url === launchUrl) && <option value={launchUrl}>{launchUrl}</option>}
              {launchUrlOptions.map(o => <option key={o.url} value={o.url}>{o.label}</option>)}
            </select>
            <span className="block text-[10px] text-ink-faint">Domain yang dipakai saat master campaign education diluncurkan ke GoPhish.</span>
          </label>
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
              <p className="text-ink-faint">No example images yet — upload some in the Images tab.</p>
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

        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3 text-xs">
          <span className="font-semibold text-ink-muted">Status</span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {dirty && <span className="text-ink-muted">Unsaved changes</span>}
          {isPublished && (
            page.synced_at
              ? <Badge tone="info">GoPhish: synced</Badge>
              : <Badge tone="warning">GoPhish: not synced</Badge>
          )}
          {isPublished && page.gophish_master_id && <Badge tone="success">Education campaign: ready</Badge>}
          {canPublish && isPublished && (
            <button
              type="button"
              className="font-semibold text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-60"
              onClick={() => syncMutation.mutate({ data: requestExtras })}
              disabled={busy}
              title="Push the published page to GoPhish again"
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

      {/* BOTTOM PANEL: code editor / live preview */}
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
                <span className="truncate text-sm font-semibold text-ink">{title || 'Education Page'}</span>
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
          message="The starter template will replace what is in the editor. Nothing is saved until you save the draft."
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
