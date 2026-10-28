import { useState, useMemo, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import { AssetCard, AssetCreateCard, AssetEditorLayout, AssetLockBadge, BrowserPreview, HtmlThumbnail } from '../../features/assets/components/index.js'
import { DataTable } from '../../components/DataTable/index.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
import ViewToggle from '../../components/UI/ViewToggle.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import { useMasterLandingPages } from '../../hooks/queries/useMasterAssetQueries.js'
import { useApproveMasterLandingPageVersionMutation, useCreateMasterLandingPageMutation, useDeleteMasterLandingPageMutation, useDuplicateMasterLandingPageMutation, useUpdateMasterLandingPageMutation } from '../../hooks/mutations/useMasterAssetMutations.js'
import useAppStore from '../../store/useAppStore.js'
import { canManagePukat } from '../../utils/roles.js'
import { assetEntityForUser, canUserCreateAsset, canUserEditAsset, filterAssetsForUser } from '../../utils/entityAssignmentHelpers.js'
import { buildMasterLandingPagePayload, masterAssetLockMessage, masterLandingPageToUiPage } from '../../utils/masterAssetHelpers.js'
import { paginateRows } from '../../utils/clientTableState.js'

const VIEW_MODE_OPTIONS = [
  { value: 'grid', icon: 'ti-layout-grid', label: 'Grid view' },
  { value: 'table', icon: 'ti-list', label: 'Table view' },
]

const LANDING_TABLE_DEFAULT_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 10, filters: {} }
const LANDING_STATUS_TONES = { Published: 'success', Draft: 'gray' }

/* ─── Data ───────────────────────────────────────────────────────────── */

const LANDING_PAGES = []

/* ─── Sub-components ─────────────────────────────────────────────────── */

function CaptureBadge({ label }) {
  const isPass = label === 'Pass'
  return (
    <span
      className={clsx(
        'rounded-full text-[9px] font-semibold px-1.5 py-0.5',
        isPass ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      )}
    >
      {label} ✓
    </span>
  )
}

function ThumbnailMockup({ page }) {
  return (
    <div className="h-32 rounded-lg border border-line relative flex flex-col overflow-hidden select-none">
      {/* Category badge */}
      <span
        className={clsx(
          'absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm bg-panel',
          page.thumbnail?.bg?.split(' ')[1] || 'text-violet-600 dark:text-violet-400'
        )}
      >
        <i className={clsx('ti', page.thumbnail?.icon || 'ti-forms')} />
      </span>

      {/* Master badge */}
      <span className="absolute top-2 right-2 z-10 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-sm">
        Master
      </span>

      {/* Live preview */}
      <div className="relative flex-1 min-h-0 bg-panel">
        <HtmlThumbnail html={page.html} />
      </div>

      {/* Badges */}
      {page.badges?.length > 0 && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
          {page.badges.map((badge) => (
            <CaptureBadge key={badge} label={badge} />
          ))}
        </div>
      )}
    </div>
  )
}

function LandingPageCard({ page, canEdit, canApprove, onEdit, onPreview, onDelete, onApprove }) {
  const lockMessage = masterAssetLockMessage(page, 'Landing page')

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
    canApprove && {
      key: 'approve',
      label: 'Approve',
      icon: 'ti-shield-check',
      tone: 'green',
      onClick: () => onApprove(page.id),
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
      type="landing_page"
      title={page.name}
      description={page.description}
      meta={page.meta}
      chips={page.chips}
      entity={page.entity}
      locked={page.editLocked}
      lockReason={lockMessage}
      thumbnail={<ThumbnailMockup page={page} />}
      actions={actions}
      statusBadge={{
        label: page.status,
        cls: page.status === 'Published' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-panel-muted text-ink-muted',
      }}
    />
  )
}

function LandingPageEntityCell({ page }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {page.entity ? (
        <span className="inline-flex rounded-full bg-panel-muted px-2 py-0.5 text-[10px] font-semibold text-ink-muted">{page.entity}</span>
      ) : (
        <span className="text-ink-faint">—</span>
      )}
      <AssetLockBadge locked={page.editLocked} reason={masterAssetLockMessage(page, 'Landing page')} />
    </div>
  )
}

function LandingPageCaptureCell({ page }) {
  if (!page.badges?.length) return <span className="text-ink-faint">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {page.badges.map((badge) => (
        <CaptureBadge key={badge} label={badge} />
      ))}
    </div>
  )
}

function PreviewFallback() {
  return (
    <div className="text-center text-ink-faint space-y-2 py-12">
      <i className="ti ti-eye-off text-3xl" />
      <p className="text-xs font-medium">
        Silakan klik &quot;Preview&quot; pada salah satu landing page di daftar atau klik tab &quot;Editor&quot; untuk mengedit template
      </p>
    </div>
  )
}

/* ─── HTML Syntax Highlighter ────────────────────────────────────────── */

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <div class="login-card">
    <h2>Sign In</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Submit</button>
    </form>
  </div>
</body>
</html>`

/* ─── Editor Pane ────────────────────────────────────────────────────── */

function EditorPane({
  editingName,
  name,
  setName,
  htmlCode,
  setHtmlCode,
  entity,
  setEntity,
  redirectUrl,
  setRedirectUrl,
  captureData,
  setCaptureData,
  capturePass,
  setCapturePass,
  saving,
  entityLocked,
  onBack,
  onSave
}) {
  const title = editingName ? `Edit: ${editingName}` : 'Create landing page'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            HTML template configuration to capture simulated credential input
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-4 py-2 text-sm font-semibold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(name, htmlCode)}
            disabled={saving}
            className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
          >
            {saving ? 'Menyimpan...' : 'Save template'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left settings panel (2 cols) */}
        <div className="lg:col-span-2 bg-panel border border-line rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink border-b border-line-soft pb-2">
            Konfigurasi template
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-ink-soft">Nama template *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Microsoft 365 Login"
                className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-ink-soft">
                Redirect URL (setelah submit)
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-panel border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-ink-soft">Entity</label>
              <input
                type="text"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                disabled={entityLocked}
                placeholder="Contoh: EntityA"
                className={clsx(
                  'w-full border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-violet-500',
                  entityLocked ? 'bg-panel-subtle text-ink-muted' : 'bg-panel'
                )}
              />
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={captureData}
                  onChange={(e) => setCaptureData(e.target.checked)}
                  className="mt-0.5 text-violet-600 dark:text-violet-400 border-line-strong rounded focus:ring-violet-500"
                />
                <div>
                  <span className="block font-semibold text-ink">Capture submitted data</span>
                  <span className="block text-[10px] text-ink-faint mt-0.5">
                    Tangkap data parameter input yang dimasukkan user target
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={capturePass}
                  onChange={(e) => setCapturePass(e.target.checked)}
                  className="mt-0.5 text-violet-600 dark:text-violet-400 border-line-strong rounded focus:ring-violet-500"
                />
                <div>
                  <span className="block font-semibold text-ink">Capture passwords</span>
                  <span className="block text-[10px] text-ink-faint mt-0.5">
                    Tangkap input password (direkomendasikan dalam mode terenkripsi)
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <AssetEditorLayout fileName="template.html" lineCount={htmlCode.split('\n').length} lineCountLabel="baris">
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} height={420} />
        </AssetEditorLayout>
      </div>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────── */

export default function LandingPages() {
  const { data: masterPages = [], isLoading, isFetching, refetch } = useMasterLandingPages()
  const currentUser = useAppStore(state => state.user)
  const [pages, setPages] = useState(() => LANDING_PAGES.slice(0, 0))
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [tableState, setTableState] = useState(LANDING_TABLE_DEFAULT_STATE)
  const [previewTitle, setPreviewTitle] = useState('Microsoft 365 Login')

  // Editor / Preview Shared state (lifting state up)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [editingEntity, setEditingEntity] = useState('')
  const [editingRedirectUrl, setEditingRedirectUrl] = useState('https://portal.office.com')
  const [editingCaptureData, setEditingCaptureData] = useState(true)
  const [editingCapturePass, setEditingCapturePass] = useState(true)
  const [deletingPage, setDeletingPage] = useState(null)
  const [approvingPage, setApprovingPage] = useState(null)

  const [syncing, setSyncing] = useState(false)

  const resetEditorState = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingHtml('')
    setEditingEntity('')
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
  }, [])

  const closeEditor = useCallback(() => {
    setSearchQuery('')
    setActiveTab('list')
    resetEditorState()
  }, [resetEditorState])

  const createMutation = useCreateMasterLandingPageMutation({ onSuccess: closeEditor })
  const updateMutation = useUpdateMasterLandingPageMutation({ onSuccess: closeEditor })
  const deleteMutation = useDeleteMasterLandingPageMutation({
    onSuccess: () => setDeletingPage(null),
  })
  const approveMutation = useApproveMasterLandingPageVersionMutation({
    onSuccess: () => setApprovingPage(null),
  })
  const duplicateMutation = useDuplicateMasterLandingPageMutation({ onSuccess: closeEditor })
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const defaultEntity = useMemo(() => assetEntityForUser(currentUser), [currentUser])
  const canCreateAssets = useMemo(() => canUserCreateAsset(currentUser), [currentUser])
  const entityLocked = !canManagePukat(currentUser.role)
  const canApproveLandingPages = useAppStore(state => state.hasPermission('master_landing_pages.approve'))

  useEffect(() => {
    const visiblePages = filterAssetsForUser(
      masterPages.map(masterLandingPageToUiPage),
      currentUser
    )
    setPages(visiblePages)
  }, [currentUser, masterPages])

  /* ── Filtered cards ── */
  const categoryFilteredPages = useMemo(() => {
    if (activeFilter === 'all') return pages
    return pages.filter((p) => p.category === activeFilter)
  }, [pages, activeFilter])

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return categoryFilteredPages
    const q = searchQuery.toLowerCase()
    return categoryFilteredPages.filter((p) => p.name.toLowerCase().includes(q))
  }, [categoryFilteredPages, searchQuery])

  const categories = useMemo(() => {
    return [
      { key: 'all', label: 'Semua', count: pages.length },
      { key: 'login', label: 'Login page', count: pages.filter((p) => p.category === 'login').length },
      { key: 'form', label: 'Form submission', count: pages.filter((p) => p.category === 'form').length },
      { key: 'redirect', label: 'Redirect only', count: pages.filter((p) => p.category === 'redirect').length },
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
        toast.error(masterAssetLockMessage(page, 'Landing page'))
        return
      }

      setEditingId(page.id)
      setEditingName(page.name)
      setEditingHtml(page.html || '')
      setEditingEntity(page.entity || '')
      setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
      setEditingCaptureData(page.badges?.includes('Data') ?? true)
      setEditingCapturePass(page.badges?.includes('Pass') ?? true)
      setActiveTab('editor')
    }
  }, [currentUser, pages])

  const handlePreview = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setPreviewTitle(page.name)
      setEditingId(page.id)
      setEditingName(page.name)
      setEditingHtml(page.html || '')
      setEditingEntity(page.entity || '')
      setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
      setEditingCaptureData(page.badges?.includes('Data') ?? true)
      setEditingCapturePass(page.badges?.includes('Pass') ?? true)
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
    setEditingHtml(DEFAULT_HTML)
    setEditingEntity(defaultEntity)
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
    setActiveTab('editor')
  }, [canCreateAssets, defaultEntity])

  const handleSave = useCallback((name, html) => {
    const currentAsset = editingId ? pages.find((page) => page.id === editingId) : null
    if (currentAsset && !canUserEditAsset(currentAsset, currentUser)) {
      toast.error('Asset ini hanya bisa diedit oleh admin atau user dengan entity yang sama.')
      return
    }
    if (currentAsset?.editLocked) {
      toast.error(masterAssetLockMessage(currentAsset, 'Landing page'))
      return
    }
    if (!currentAsset && !canCreateAssets) {
      toast.error('User non-admin harus memiliki entity untuk membuat asset.')
      return
    }

    if (!name.trim() || !html.trim()) {
      toast.error('Nama landing page dan HTML wajib diisi.')
      return
    }

    const payloadEntity = entityLocked ? defaultEntity : editingEntity
    const payload = buildMasterLandingPagePayload({
      name,
      html,
      redirectUrl: editingRedirectUrl,
      entity: payloadEntity,
      captureData: editingCaptureData,
      capturePass: editingCapturePass,
    })

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [canCreateAssets, createMutation, currentUser, defaultEntity, editingCaptureData, editingCapturePass, editingEntity, editingId, editingRedirectUrl, entityLocked, pages, updateMutation])

  const handleDelete = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (!page) return
    if (!canUserEditAsset(page, currentUser)) {
      toast.error('Asset ini hanya bisa dihapus oleh admin atau user dengan entity yang sama.')
      return
    }
    if (page.editLocked) {
      toast.error(masterAssetLockMessage(page, 'Landing page'))
      return
    }

    setDeletingPage(page)
  }, [currentUser, pages])

  const confirmDelete = useCallback(() => {
    if (!deletingPage) return
    if (deletingPage.editLocked) {
      toast.error(masterAssetLockMessage(deletingPage, 'Landing page'))
      return
    }

    deleteMutation.mutate(deletingPage.id)
  }, [deleteMutation, deletingPage])

  const handleApprove = useCallback((id) => {
    const page = pages.find((p) => p.id === id)
    if (page) {
      setApprovingPage(page)
    }
  }, [pages])

  const confirmApprove = useCallback(() => {
    if (!approvingPage) return
    approveMutation.mutate(approvingPage.versionId)
  }, [approveMutation, approvingPage])

  const previewSource = useMemo(
    () => (editingId ? pages.find((p) => p.id === editingId) : null),
    [editingId, pages]
  )

  // Editor and preview share the editing* state, so the open asset may carry
  // unsaved edits. Duplicate copies the *saved* version from the backend, so we
  // block it when the on-screen draft has diverged to avoid a confusing mismatch.
  const previewHasUnsavedEdits = Boolean(
    previewSource && (
      editingName !== previewSource.name
      || editingHtml !== (previewSource.html || '')
      || editingEntity !== (previewSource.entity || '')
      || editingRedirectUrl !== (previewSource.redirectUrl || 'https://portal.office.com')
      || editingCaptureData !== (previewSource.badges?.includes('Data') ?? true)
      || editingCapturePass !== (previewSource.badges?.includes('Pass') ?? true)
    )
  )

  const handleDuplicate = useCallback(() => {
    if (!canCreateAssets) {
      toast.error('User non-admin harus memiliki entity untuk membuat asset.')
      return
    }

    if (!previewSource) {
      toast.error('Pilih landing page dari daftar terlebih dahulu sebelum menduplikasi.')
      return
    }

    if (previewHasUnsavedEdits) {
      toast.error('Simpan perubahan di Editor dulu — duplicate menyalin versi yang tersimpan.')
      return
    }

    const source = previewSource

    // Clone is never blocked by editLocked — it writes a brand-new draft row.
    // Non-admins must claim the copy for their own entity; the backend forces
    // that anyway and rejects a General/foreign entity outright.
    duplicateMutation.mutate({
      id: source.id,
      data: {
        name: `Copy of ${source.name}`,
        entity: entityLocked ? defaultEntity : (source.entity || ''),
      },
    })
  }, [canCreateAssets, defaultEntity, duplicateMutation, entityLocked, previewHasUnsavedEdits, previewSource])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    const result = await refetch()
    setSyncing(false)

    if (result.error) {
      toast.error(result.error.message || 'Gagal memuat landing page dari master database.')
      return
    }

    toast.success(`Master database refreshed - ${result.data?.length ?? 0} landing pages`)
  }, [refetch])

  function renderLandingPageActionsCell(page) {
    const canEdit = canUserEditAsset(page, currentUser)
    const canApprove = canApproveLandingPages
      && page.status !== 'Published'
      && Number(currentUser.id) !== Number(page.versionCreatedBy)
      && Number(currentUser.id) !== Number(page.versionUpdatedBy)
    const lockMessage = masterAssetLockMessage(page, 'Landing page')

    const menuItems = [
      canEdit && { key: 'edit', label: 'Edit', icon: 'ti-edit', disabled: page.editLocked, reason: page.editLocked ? lockMessage : undefined },
      canEdit && { key: 'delete', label: 'Delete', icon: 'ti-trash', disabled: page.editLocked, reason: page.editLocked ? lockMessage : undefined },
      canApprove && { key: 'approve', label: 'Approve', icon: 'ti-shield-check' },
    ].filter(Boolean)

    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => handlePreview(page.id)}>
          <i className="ti ti-eye" />
          Preview
        </Button>
        <TableActionMenu
          items={menuItems}
          triggerTitle="More Actions"
          onSelect={actionKey => {
            if (actionKey === 'edit') handleEdit(page.id)
            else if (actionKey === 'delete') handleDelete(page.id)
            else if (actionKey === 'approve') handleApprove(page.id)
          }}
        />
      </div>
    )
  }

  const landingPageColumns = [
    { key: 'name', label: 'Landing page', renderer: 'text_with_subtext', subtextKey: 'description', sortable: true },
    { key: 'redirectUrl', label: 'Redirect URL', renderer: 'text' },
    { key: 'entity', label: 'Entity', renderer: 'custom', render: page => <LandingPageEntityCell page={page} /> },
    { key: 'capture', label: 'Capture', renderer: 'custom', render: page => <LandingPageCaptureCell page={page} /> },
    { key: 'status', label: 'Status', renderer: 'badge', toneMap: LANDING_STATUS_TONES },
    { key: 'actions', label: '', renderer: 'custom', align: 'right', render: renderLandingPageActionsCell },
  ]

  const { rows: landingTableRows, total: landingTableTotal } = useMemo(
    () => paginateRows(categoryFilteredPages, tableState, { searchFields: ['name', 'description', 'redirectUrl'] }),
    [categoryFilteredPages, tableState],
  )

  /* ── Tab button classes ── */
  const tabBtnClass = (tab) =>
    clsx(
      'landing-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none',
      activeTab === tab
        ? 'border-violet-500 text-violet-500'
        : 'border-transparent text-ink-muted hover:text-ink-soft hover:border-line-strong'
    )

  /* ── Filter pill classes ── */
  const pillClass = (key) =>
    clsx(
      'landing-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none',
      activeFilter === key
        ? 'bg-ink text-canvas'
        : 'bg-panel border border-line text-ink-muted hover:bg-panel-subtle'
    )

  return (
    <PageShell>
      {/* ── Header ── */}
      <PageHeader
        title="Landing pages"
        subtitle="Managed from a master database"
        actions={
          <>
            {/* Search bar (table view has its own, in the DataTable toolbar) */}
            {viewMode === 'grid' && (
              <div className="relative w-64">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-faint">
                  <i className="ti ti-search text-base" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari landing page..."
                  className="w-full bg-panel border border-line rounded-xl pl-9 pr-4 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            )}
            {/* Sync button */}
            <Button variant="outline" onClick={handleSync} disabled={syncing || isFetching}>
              <i className={clsx('ti ti-refresh text-base', (syncing || isFetching) && 'animate-spin')} />
              <span>Refresh master</span>
            </Button>
            {/* Create button */}
            {canCreateAssets && (
              <Button variant="primary" onClick={handleCreate}>
                <i className="ti ti-plus text-base" />
                <span>Create landing page</span>
              </Button>
            )}
          </>
        }
      />

      {/* ── Sub Tab Bar ── */}
      <div className="border-b border-line">
        <nav className="flex gap-6 -mb-px" aria-label="Landing page subtabs">
          <button onClick={() => switchTab('list')} className={tabBtnClass('list')}>
            <i className="ti ti-list text-base" />
            <span>List of Landing Page</span>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <ViewToggle value={viewMode} onChange={setViewMode} options={VIEW_MODE_OPTIONS} />
            </div>

            {isLoading && (
              <div className="bg-panel border border-line rounded-xl p-8 text-center text-sm text-ink-faint">
                Memuat landing page dari master database...
              </div>
            )}

            {/* Landing Pages Grid */}
            {!isLoading && viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPages.map((page) => (
                  <LandingPageCard
                    key={page.id}
                    page={page}
                    canEdit={canUserEditAsset(page, currentUser)}
                    canApprove={
                      canApproveLandingPages
                      && page.status !== 'Published'
                      && Number(currentUser.id) !== Number(page.versionCreatedBy)
                      && Number(currentUser.id) !== Number(page.versionUpdatedBy)
                    }
                    onEdit={handleEdit}
                    onPreview={handlePreview}
                    onDelete={handleDelete}
                    onApprove={handleApprove}
                  />
                ))}
                {canCreateAssets && <AssetCreateCard label="Create landing page" onClick={handleCreate} />}
              </div>
            )}

            {/* Landing Pages Table */}
            {!isLoading && viewMode === 'table' && (
              <DataTable
                tableKey="landing_pages"
                schema={{ columns: landingPageColumns, search: { placeholder: 'Cari landing page...' } }}
                rows={landingTableRows}
                meta={{ total: landingTableTotal, per_page: tableState.perPage }}
                state={tableState}
                onStateChange={setTableState}
              />
            )}
          </div>
        )}

        {/* TAB 2: EDITOR PANE */}
        {activeTab === 'editor' && (
          <EditorPane
            editingName={editingName}
            name={editingName}
            setName={setEditingName}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
            entity={editingEntity}
            setEntity={setEditingEntity}
            redirectUrl={editingRedirectUrl}
            setRedirectUrl={setEditingRedirectUrl}
            captureData={editingCaptureData}
            setCaptureData={setEditingCaptureData}
            capturePass={editingCapturePass}
            setCapturePass={setEditingCapturePass}
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
                <h2 className="text-lg font-bold text-ink">{previewTitle}</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Preview how the landing page appears to the target.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {canCreateAssets && previewSource && (
                  <Button
                    variant="outline"
                    onClick={() => handleDuplicate()}
                    disabled={duplicateMutation.isPending || previewHasUnsavedEdits}
                    title={previewHasUnsavedEdits
                      ? 'Simpan perubahan di Editor dulu — duplicate menyalin versi yang tersimpan.'
                      : `Duplicate "${previewTitle}" as a new draft`}
                  >
                    <i className="ti ti-copy text-base" />
                    <span>{duplicateMutation.isPending ? 'Menduplikasi...' : 'Duplicate landing page'}</span>
                  </Button>
                )}
                <button
                  onClick={() => switchTab('list')}
                  className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-4 py-2 text-sm font-semibold rounded-xl transition-all"
                >
                  Return to List
                </button>
              </div>
            </div>

            {/* Preview Viewport */}
            <div className="border border-line rounded-xl overflow-hidden bg-panel-muted flex flex-col items-center justify-center p-6 min-h-[450px]">
              {editingHtml ? (
                <BrowserPreview html={editingHtml} redirectUrl={editingRedirectUrl} />
              ) : (
                <PreviewFallback />
              )}
            </div>
          </div>
        )}
      </div>

      {deletingPage && (
        <AlertConfirmation
          title="Delete landing page?"
          message={`Delete "${deletingPage.name}" from master database?`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingPage(null)}
          onConfirm={confirmDelete}
        />
      )}

      {approvingPage && (
        <AlertConfirmation
          title="Approve landing page version?"
          message={`Approve the current version of "${approvingPage.name}"? It will become available for use in campaigns.`}
          icon="ti-shield-check"
          tone="warning"
          confirmLabel="Approve"
          pendingLabel="Approving..."
          isPending={approveMutation.isPending}
          onCancel={() => setApprovingPage(null)}
          onConfirm={confirmApprove}
        />
      )}
    </PageShell>
  )
}
