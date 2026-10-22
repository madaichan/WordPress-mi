import { useEffect, useState } from 'react'
import { useQuizTemplate } from '../../../hooks/queries/useQuizQueries.js'
import { BrowserPreview } from '../../assets/components/index.js'
import HtmlCodeEditor from '../../../components/Editor/HtmlCodeEditor.jsx'
import Badge from '../../../components/UI/Badge.jsx'
import Button from '../../../components/UI/Button.jsx'
import Drawer from '../../../components/UI/Drawer.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import Select from '../../../components/UI/Select.jsx'

const STARTER_HTML = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8" /><title>{{pukat:title}}</title></head>
<body>
  <h1>{{pukat:title}}</h1>
  <p>{{pukat:intro}}</p>
  <form method="post">
    <input type="hidden" name="rid" value="{{.RId}}" />
    {{pukat:questions}}
    <button type="submit">Kirim Jawaban</button>
  </form>
</body>
</html>`

const BLANK = {
  name: '',
  description: '',
  html_body: STARTER_HTML,
  placeholders: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'intro', label: 'Intro', type: 'textarea', required: false },
  ],
  is_active: true,
}

/**
 * Admin-only catalogue of reusable quiz templates (docs/PRD_QUIZ_MODULE.md §13).
 * A template is a styled HTML shell with two kinds of marker: {{pukat:questions}}
 * (the one repeating question slot) and {{pukat:<key>}} placeholders the operator
 * fills in the builder. The backend validates both on save.
 *
 * A container: owns the drawer's form state and calls the mutations the page
 * hands it. Rendered only for admins (quiz_templates.*).
 */
export default function QuizTemplateAdminPanel({ templates = [], busy = false, onCreate, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [preview, setPreview] = useState(false)
  // When editing an existing template we need its html_body, which the list omits.
  const { data: full } = useQuizTemplate(editing?.id, { enabled: Boolean(editing?.id) && !editing?._loaded })

  useEffect(() => {
    if (editing?.id && full && !editing._loaded) {
      setEditing(e => ({ ...e, html_body: full.html_body || '', _loaded: true }))
    }
  }, [editing?.id, editing?._loaded, full])

  const openNew = () => { setPreview(false); setEditing({ ...BLANK, placeholders: BLANK.placeholders.map(p => ({ ...p })), _loaded: true }) }
  const openEdit = (t) => {
    setPreview(false)
    setEditing({
      id: t.id,
      name: t.name || '',
      description: t.description || '',
      html_body: '',
      placeholders: (t.placeholders || []).map(p => ({ ...p })),
      is_active: t.is_active !== false,
      _loaded: false,
    })
  }

  function patchPh(index, patch) {
    setEditing(e => ({ ...e, placeholders: e.placeholders.map((p, i) => (i === index ? { ...p, ...patch } : p)) }))
  }

  function submit() {
    const data = {
      name: editing.name.trim(),
      description: editing.description.trim(),
      html_body: editing.html_body,
      placeholders: editing.placeholders
        .map(p => ({ key: String(p.key || '').trim().toLowerCase(), label: p.label?.trim() || p.key, type: p.type || 'text', required: Boolean(p.required) }))
        .filter(p => p.key !== ''),
      is_active: Boolean(editing.is_active),
    }
    const done = () => setEditing(null)
    if (editing.id) onUpdate?.({ id: editing.id, data }, done)
    else onCreate?.(data, done)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-xs text-ink-muted">
          Templates are the styled shells operators pick in the builder. Put the one question slot where questions should render:
          <span className="mx-1 font-mono text-ink-soft">{'{{pukat:questions}}'}</span>, and declare any fillable fields as
          <span className="mx-1 font-mono text-ink-soft">{'{{pukat:key}}'}</span>.
        </p>
        <Button variant="primary" size="sm" onClick={openNew} disabled={busy}>
          <i className="ti ti-plus text-sm" />
          <span>New template</span>
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon="ti-layout-board" title="No templates yet" description="Create the first quiz template operators can build from." />
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {templates.map(t => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{t.name}</span>
                  {t.is_active === false && <Badge tone="gray">Inactive</Badge>}
                  <span className="text-[11px] text-ink-faint">{(t.placeholders || []).length} field(s)</span>
                </div>
                {t.description && <p className="text-[11px] text-ink-faint">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)} disabled={busy}>Edit</Button>
                <Button variant="outline" size="sm" onClick={() => onDelete?.(t)} disabled={busy}>
                  <i className="ti ti-trash text-sm text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Drawer
          onClose={() => setEditing(null)}
          title={editing.id ? 'Edit template' : 'New template'}
          widthClass="max-w-3xl"
          footer={(
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setPreview(p => !p)}>{preview ? 'Edit HTML' : 'Preview'}</Button>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
                <Button variant="primary" onClick={submit} disabled={busy}>{editing.id ? 'Save template' : 'Create template'}</Button>
              </div>
            </div>
          )}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="font-semibold text-ink-soft">Name *</span>
                <input value={editing.name} onChange={e => setEditing(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500" />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input type="checkbox" checked={editing.is_active} onChange={e => setEditing(f => ({ ...f, is_active: e.target.checked }))} />
                <span className="text-ink-soft">Active (shown to operators)</span>
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-semibold text-ink-soft">Description</span>
              <input value={editing.description} onChange={e => setEditing(f => ({ ...f, description: e.target.value }))}
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-violet-500" />
            </label>

            <div className="space-y-2">
              <span className="font-semibold text-ink-soft">Fillable fields (placeholders)</span>
              {editing.placeholders.map((ph, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input value={ph.key} onChange={e => patchPh(index, { key: e.target.value })} placeholder="key"
                    className="w-28 rounded-lg border border-line bg-panel px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-violet-500" />
                  <input value={ph.label} onChange={e => patchPh(index, { label: e.target.value })} placeholder="Label"
                    className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none focus:border-violet-500" />
                  <Select value={ph.type} onChange={e => patchPh(index, { type: e.target.value })} className="w-28">
                    <option value="text">text</option>
                    <option value="textarea">textarea</option>
                  </Select>
                  <label className="flex items-center gap-1 text-[11px] text-ink-soft"><input type="checkbox" checked={Boolean(ph.required)} onChange={e => patchPh(index, { required: e.target.checked })} />req</label>
                  <button type="button" onClick={() => setEditing(f => ({ ...f, placeholders: f.placeholders.filter((_, i) => i !== index) }))} className="text-ink-faint hover:text-danger"><i className="ti ti-x text-sm" /></button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEditing(f => ({ ...f, placeholders: [...f.placeholders, { key: '', label: '', type: 'text', required: false }] }))}>
                <i className="ti ti-plus text-sm" /><span>Add field</span>
              </Button>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-ink-soft">Template HTML</span>
              {preview
                ? <BrowserPreview html={editing.html_body} title="Template preview (markers not filled)" />
                : <HtmlCodeEditor value={editing.html_body} onChange={v => setEditing(f => ({ ...f, html_body: v }))} height={420} />}
              <p className="text-[10px] text-ink-faint">Must contain <span className="font-mono">{'{{pukat:questions}}'}</span> exactly once and a <span className="font-mono">{'<form method="post">'}</span>.</p>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  )
}
