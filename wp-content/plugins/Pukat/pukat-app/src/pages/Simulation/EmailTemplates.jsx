import { useState, useMemo, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import ClientPreview from '../../components/Editor/ClientPreview.jsx'
import { AssetCard, AssetCreateCard, AssetEditorLayout } from '../../features/assets/components/index.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import { useMasterEmailTemplates } from '../../hooks/queries/useMasterAssetQueries.js'
import { useCreateMasterEmailTemplateMutation, useDeleteMasterEmailTemplateMutation, useUpdateMasterEmailTemplateMutation } from '../../hooks/mutations/useMasterAssetMutations.js'
import useAppStore from '../../store/useAppStore.js'
import { canManagePukat } from '../../utils/roles.js'
import { assetEntityForUser, canUserCreateAsset, canUserEditAsset, filterAssetsForUser } from '../../utils/entityAssignmentHelpers.js'
import { buildMasterEmailTemplatePayload, masterAssetLockMessage, masterEmailTemplateToUiTemplate } from '../../utils/masterAssetHelpers.js'

/* ─── Default Data ───────────────────────────────────────────────────── */

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .btn { background-color: #6C63FF; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h3>Aktivitas Akun Tidak Biasa</h3>
    <p>Halo {{.FirstName}},</p>
    <p>Kami mendeteksi adanya upaya sign-in tidak dikenal pada akun Anda.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{.URL}}" class="btn">Verifikasi Akun</a>
    </div>
  </div>
</body>
</html>`

const EMAIL_TEMPLATES = []

/* ─── List Layout Helper Components ───────────────────────────────────── */

function ThumbnailMockup({ page }) {
  return (
    <div className="h-32 bg-[#1F1F1F] rounded-lg border border-gray-800 p-3 relative flex flex-col justify-center gap-2 overflow-hidden select-none">
      <span className="absolute top-2 right-2 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">
        Master
      </span>
      <div className="flex items-center gap-2">
        <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold", page.thumbnail?.bg || 'bg-violet-500/20 text-violet-500')}>
          <i className={clsx("ti", page.thumbnail?.icon || 'ti-mail')} />
        </div>
        <div className="space-y-1">
          <div className="h-2 bg-gray-500/80 w-16 rounded" />
          <div className="h-1.5 bg-gray-600/60 w-24 rounded" />
        </div>
      </div>
      <div className="space-y-2 mt-2">
        <div className="h-2 bg-gray-700/60 w-full rounded" />
        <div className="h-2 bg-gray-700/60 w-4/5 rounded" />
      </div>
    </div>
  )
}

function EmailTemplateCard({ page, canEdit, onEdit, onPreview, onDelete }) {
  const lockMessage = masterAssetLockMessage(page, 'Email template')

  const actions = [
    canEdit && {
      key: 'edit',
      label: 'Edit',
      icon: 'ti-edit',
      disabled: page.editLocked,
      title: page.editLocked ? lockMessage : 'Edit',
      onClick: () => onEdit(page.id),
    },
    canEdit && {
      key: 'delete',
      label: 'Delete',
      icon: 'ti-trash',
      tone: 'red',
      disabled: page.editLocked,
      title: page.editLocked ? lockMessage : 'Delete',
      onClick: () => onDelete(page.id),
    },
    {
      key: 'preview',
      label: 'Preview',
      icon: 'ti-eye',
      onClick: () => onPreview(page.id),
    },
  ].filter(Boolean)

  return (
    <AssetCard
      asset={page}
      type="email_template"
      title={page.name}
      description={page.description}
      entity={page.entity}
      locked={page.editLocked}
      lockReason={lockMessage}
      thumbnail={<ThumbnailMockup page={page} />}
      actions={actions}
    />
  )
}

/* ─── Client Preview Frame ───────────────────────────────────────────── */

function PreviewFallback() {
  return (
    <div className="text-center text-gray-400 space-y-2 py-12">
      <i className="ti ti-mail-opened text-3xl" />
      <p className="text-xs font-medium">
        Silakan klik &quot;Preview&quot; pada salah satu template email di daftar atau klik tab &quot;Editor&quot; untuk mengedit template
      </p>
    </div>
  )
}

/* ─── Editor Pane ────────────────────────────────────────────────────── */

function EditorPane({
  editingName,
  name,
  setName,
  sender,
  setSender,
  entity,
  setEntity,
  subject,
  setSubject,
  htmlCode,
  setHtmlCode,
  saving,
  entityLocked,
  onBack,
  onSave
}) {
  const title = editingName ? `Edit template: ${editingName}` : 'Buat email template'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Konfigurasi envelope header dan kode HTML email phishing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(name, htmlCode)}
            disabled={saving}
            className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Simpan template'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left settings panel */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Envelope headers
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Nama template *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Microsoft O365 Alert"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Pengirim (Envelope From) *</label>
              <input
                type="text"
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="Contoh: Admin <admin@company.id>"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Entity</label>
              <input
                type="text"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                disabled={entityLocked}
                placeholder="Contoh: EntityA"
                className={clsx(
                  'w-full border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500',
                  entityLocked ? 'bg-gray-50 text-gray-500' : 'bg-white'
                )}
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Subjek Email *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subjek email phishing"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>

            <div className="pt-2">
              <span className="block font-semibold text-gray-900 mb-1.5">Variabel dinamis</span>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Gunakan placeholder GoPhish berikut untuk personalisasi otomatis:
              </p>
              <div className="grid grid-cols-2 gap-1.5 mt-2 font-mono text-[9px] text-gray-600 select-all">
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.FirstName}}"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.Email}}"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.URL}} (Phish Link)"}
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-center">
                  {"{{.Position}}"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AssetEditorLayout fileName="email_source.html" lineCount={htmlCode.split('\n').length} lineCountLabel="baris" elevated>
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} />
        </AssetEditorLayout>
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function EmailTemplates() {
  const { data: masterTemplates = [], isLoading, isFetching, refetch } = useMasterEmailTemplates()
  const currentUser = useAppStore(state => state.user)
  const [pages, setPages] = useState(() => EMAIL_TEMPLATES.slice(0, 0))
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewTitle, setPreviewTitle] = useState('Microsoft Office 365 Alert')

  // Shared editing/preview status
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingSender, setEditingSender] = useState('')
  const [editingEntity, setEditingEntity] = useState('')
  const [editingSubject, setEditingSubject] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [deletingTemplate, setDeletingTemplate] = useState(null)

  const [syncing, setSyncing] = useState(false)

  const resetEditorState = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingSender('')
    setEditingEntity('')
    setEditingSubject('')
    setEditingHtml('')
  }, [])

  const closeEditor = useCallback(() => {
    setSearchQuery('')
    setActiveTab('list')
    resetEditorState()
  }, [resetEditorState])

  const createMutation = useCreateMasterEmailTemplateMutation({ onSuccess: closeEditor })
  const updateMutation = useUpdateMasterEmailTemplateMutation({ onSuccess: closeEditor })
  const deleteMutation = useDeleteMasterEmailTemplateMutation({
    onSuccess: () => setDeletingTemplate(null),
  })
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const defaultEntity = useMemo(() => assetEntityForUser(currentUser), [currentUser])
  const canCreateAssets = useMemo(() => canUserCreateAsset(currentUser), [currentUser])
  const entityLocked = !canManagePukat(currentUser.role)

  useEffect(() => {
    const visibleTemplates = filterAssetsForUser(
      masterTemplates.map(masterEmailTemplateToUiTemplate),
      currentUser
    )
    setPages(visibleTemplates)
  }, [currentUser, masterTemplates])

  /* ── Filtered cards ── */
  const filteredPages = useMemo(() => {
    let list = pages
    if (activeFilter !== 'all') {
      list = list.filter((p) => p.category === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [pages, activeFilter, searchQuery])

  const categories = useMemo(() => {
    return [
      { key: 'all', label: 'Semua', count: pages.length },
      { key: 'alert', label: 'Security alert', count: pages.filter((p) => p.category === 'alert').length },
      { key: 'info', label: 'Internal info', count: pages.filter((p) => p.category === 'info').length },
      { key: 'urgent', label: 'Urgent notification', count: pages.filter((p) => p.category === 'urgent').length },
    ]
  }, [pages])

  /* ── Handlers ── */
  const switchTab = useCallback((tab) => {
    if (tab === 'editor') {
      toast.error('Editor hanya tersedia dari tombol buat atau edit asset yang sesuai entity user.')
      return
    }

    setActiveTab(tab)
    if (tab === 'list') {
      resetEditorState()
    }
  }, [resetEditorState])

  const handleEdit = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      if (!canUserEditAsset(page, currentUser)) {
        toast.error('Asset General hanya bisa diedit admin. Non-admin hanya bisa edit asset sesuai entity user.')
        return
      }
      if (page.editLocked) {
        toast.error(masterAssetLockMessage(page, 'Email template'))
        return
      }

      setEditingId(page.id)
      setEditingName(page.name)
      setEditingSender(page.sender || 'Admin <admin@company.id>')
      setEditingEntity(page.entity || '')
      setEditingSubject(page.subject || '')
      setEditingHtml(page.html || '')
      setActiveTab('editor')
    }
  }, [currentUser, pages])

  const handlePreview = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setPreviewTitle(page.name)
      setEditingId(page.id)
      setEditingName(page.name)
      setEditingSender(page.sender || 'Admin <admin@company.id>')
      setEditingEntity(page.entity || '')
      setEditingSubject(page.subject || '')
      setEditingHtml(page.html || '')
      setActiveTab('preview')
    }
  }, [pages])

  const handleCreate = useCallback(() => {
    if (!canCreateAssets) {
      toast.error('User non-admin harus memiliki entity untuk membuat asset.')
      return
    }

    setEditingId(null)
    setEditingName('')
    setEditingSender('Admin <admin@company.id>')
    setEditingEntity(defaultEntity)
    setEditingSubject('Tindakan Diperlukan: Notifikasi Penting')
    setEditingHtml(DEFAULT_HTML)
    setActiveTab('editor')
  }, [canCreateAssets, defaultEntity])

  const handleSave = useCallback((name, html) => {
    const currentAsset = editingId ? pages.find((page) => page.id === editingId) : null
    if (currentAsset && !canUserEditAsset(currentAsset, currentUser)) {
      toast.error('Asset ini hanya bisa diedit oleh admin atau user dengan entity yang sama.')
      return
    }
    if (currentAsset?.editLocked) {
      toast.error(masterAssetLockMessage(currentAsset, 'Email template'))
      return
    }
    if (!currentAsset && !canCreateAssets) {
      toast.error('User non-admin harus memiliki entity untuk membuat asset.')
      return
    }

    if (!name.trim() || !editingSender.trim() || !editingSubject.trim() || !html.trim()) {
      toast.error('Nama template, pengirim, subjek, dan HTML wajib diisi.')
      return
    }

    const payloadEntity = entityLocked ? defaultEntity : editingEntity
    const payload = buildMasterEmailTemplatePayload({
      name,
      sender: editingSender,
      entity: payloadEntity,
      subject: editingSubject,
      html,
      text: '',
      status: 'Published',
    })

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [canCreateAssets, createMutation, currentUser, defaultEntity, editingEntity, editingId, editingSender, editingSubject, entityLocked, pages, updateMutation])

  const handleDelete = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (!page) return
    if (!canUserEditAsset(page, currentUser)) {
      toast.error('Asset ini hanya bisa dihapus oleh admin atau user dengan entity yang sama.')
      return
    }
    if (page.editLocked) {
      toast.error(masterAssetLockMessage(page, 'Email template'))
      return
    }

    setDeletingTemplate(page)
  }, [currentUser, pages])

  const confirmDelete = useCallback(() => {
    if (!deletingTemplate) return
    if (deletingTemplate.editLocked) {
      toast.error(masterAssetLockMessage(deletingTemplate, 'Email template'))
      return
    }

    deleteMutation.mutate(deletingTemplate.id)
  }, [deleteMutation, deletingTemplate])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    const result = await refetch()
    setSyncing(false)

    if (result.error) {
      toast.error(result.error.message || 'Gagal memuat email template dari master database.')
      return
    }

    toast.success(`Master database refreshed - ${result.data?.length ?? 0} email templates`)
  }, [refetch])

  /* ── Tab button classes ── */
  const tabBtnClass = (tab) =>
    clsx(
      'email-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none',
      activeTab === tab
        ? 'border-violet-500 text-violet-500'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    )

  /* ── Filter pill classes ── */
  const pillClass = (key) =>
    clsx(
      'email-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none',
      activeFilter === key
        ? 'bg-gray-950 text-white'
        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
    )

  return (
    <PageShell>
      {/* ── Header ── */}
      <PageHeader
        title="Email templates"
        subtitle="Kelola template email phishing simulasi"
        actions={
          <>
            {/* Search bar */}
            <div className="relative w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <i className="ti ti-search text-base" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari template..."
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-950 placeholder-gray-400 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            {/* Sync button */}
            <Button variant="outline" onClick={handleSync} disabled={syncing || isFetching}>
              <i className={clsx('ti ti-refresh text-base', (syncing || isFetching) && 'animate-spin')} />
              <span>Refresh master</span>
            </Button>
            {/* Create button */}
            {canCreateAssets && (
              <Button variant="primary" onClick={handleCreate}>
                <i className="ti ti-plus text-base" />
                <span>Buat email template</span>
              </Button>
            )}
          </>
        }
      />

      {/* ── Sub Tab Bar ── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px" aria-label="Email template subtabs">
          <button onClick={() => switchTab('list')} className={tabBtnClass('list')}>
            <i className="ti ti-list text-base" />
            <span>Daftar template</span>
          </button>
          {activeTab === 'editor' && (
            <button onClick={() => switchTab('list')} className={tabBtnClass('editor')}>
              <i className="ti ti-edit text-base" />
              <span>Editor</span>
            </button>
          )}
          <button onClick={() => switchTab('preview')} className={tabBtnClass('preview')}>
            <i className="ti ti-eye text-base" />
            <span>Preview</span>
          </button>
        </nav>
      </div>

      {/* ── Tab Panes ── */}
      <div className="space-y-6">
        {/* TAB 1: LIST PANE */}
        {activeTab === 'list' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveFilter(cat.key)}
                  className={pillClass(cat.key)}
                >
                  {cat.label} ({cat.count})
                </button>
              ))}
            </div>

            {/* Email Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                  Memuat email template dari master database...
                </div>
              )}
              {!isLoading && filteredPages.map((page) => (
                <EmailTemplateCard
                  key={page.id}
                  page={page}
                  canEdit={canUserEditAsset(page, currentUser)}
                  onEdit={handleEdit}
                  onPreview={handlePreview}
                  onDelete={handleDelete}
                />
              ))}
              {canCreateAssets && <AssetCreateCard label="Buat template baru" onClick={handleCreate} />}
            </div>
          </div>
        )}

        {/* TAB 2: EDITOR PANE */}
        {activeTab === 'editor' && (
          <EditorPane
            editingName={editingName}
            name={editingName}
            setName={setEditingName}
            sender={editingSender}
            setSender={setEditingSender}
            entity={editingEntity}
            setEntity={setEditingEntity}
            subject={editingSubject}
            setSubject={setEditingSubject}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
            saving={saving}
            entityLocked={entityLocked}
            onBack={() => switchTab('list')}
            onSave={handleSave}
          />
        )}

        {/* TAB 3: PREVIEW PANE */}
        {activeTab === 'preview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Menampilkan simulasi tampilan kotak masuk email di klien target
                </p>
              </div>
              <button
                onClick={() => switchTab('list')}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              >
                Kembali ke daftar
              </button>
            </div>

            {/* Simulated Inbox Viewport */}
            <div className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden flex flex-col p-4 md:p-6 min-h-[450px]">
              {editingHtml ? (
                <ClientPreview
                  html={editingHtml}
                  sender={editingSender}
                  subject={editingSubject}
                />
              ) : (
                <PreviewFallback />
              )}
            </div>
          </div>
        )}
      </div>

      {deletingTemplate && (
        <AlertConfirmation
          title="Delete email template?"
          message={`Delete "${deletingTemplate.name}" from master database?`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingTemplate(null)}
          onConfirm={confirmDelete}
        />
      )}
    </PageShell>
  )
}
