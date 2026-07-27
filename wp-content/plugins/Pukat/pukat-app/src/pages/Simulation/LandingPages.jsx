import { useState, useMemo, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import { useMasterLandingPages } from '../../hooks/queries/useMasterAssetQueries.js'
import { useCreateMasterLandingPageMutation, useDeleteMasterLandingPageMutation, useUpdateMasterLandingPageMutation } from '../../hooks/mutations/useMasterAssetMutations.js'
import useAppStore from '../../store/useAppStore.js'
import { canManagePukat } from '../../utils/roles.js'
import { assetEntityForUser, canUserCreateAsset, canUserEditAsset, filterAssetsForUser } from '../../utils/entityAssignmentHelpers.js'
import { buildMasterLandingPagePayload, masterAssetLockMessage, masterLandingPageToUiPage } from '../../utils/masterAssetHelpers.js'

/* ─── Data ───────────────────────────────────────────────────────────── */

const LANDING_PAGES = []

/* ─── Sub-components ─────────────────────────────────────────────────── */

function CaptureBadge({ label }) {
  const isPass = label === 'Pass'
  return (
    <span
      className={clsx(
        'rounded-full text-[9px] font-semibold px-1.5 py-0.5',
        isPass ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
      )}
    >
      {label} ✓
    </span>
  )
}

function ThumbnailMockup({ page }) {
  return (
    <div className="h-32 bg-[#1F1F1F] rounded-lg border border-gray-800 p-3 relative flex flex-col justify-center gap-2 overflow-hidden select-none">
      {/* Master badge */}
      <span className="absolute top-2 right-2 rounded-full text-[9px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">
        Master
      </span>

      {/* Accent element */}
      {page.thumbnail.accent}

      {/* Bars */}
      <div className="space-y-2 mt-2">
        {page.thumbnail.bars.map((bar, i) => (
          <div key={i} className={clsx('h-2.5 bg-gray-700/60 rounded', bar.w)} />
        ))}
      </div>

      {/* Badges */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        {page.badges.map((badge) => (
          <CaptureBadge key={badge} label={badge} />
        ))}
      </div>
    </div>
  )
}

function LandingPageCard({ page, canEdit, onEdit, onPreview, onDelete }) {
  const lockMessage = masterAssetLockMessage(page, 'Landing page')

  return (
    <div
      className="landing-page-card bg-white border border-gray-200 rounded-xl p-5 shadow-none flex flex-col justify-between h-80 transition-all hover:border-gray-300"
      data-category={page.category}
      data-title={page.name}
    >
      <div className="space-y-4">
        <ThumbnailMockup page={page} />
        <div>
          {page.chips ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{page.name}</h3>
              </div>
              {page.meta && (
                <p className="text-[10px] text-gray-400 mt-0.5">{page.meta}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {page.chips.map((chip) => (
                  <span
                    key={chip.label}
                    className={clsx('rounded-full text-[9px] font-semibold px-2.5 py-0.5', chip.cls)}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-gray-900">{page.name}</h3>
              {page.description && (
                <p className="text-xs text-gray-500 mt-1">{page.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {page.entity && (
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold text-gray-600">
                    {page.entity}
                  </span>
                )}
                {page.editLocked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-semibold text-red-700" title={lockMessage}>
                    <i className="ti ti-lock text-[10px]" />
                    Locked
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
        {canEdit && (
          <button
            onClick={() => onEdit(page.id)}
            disabled={page.editLocked}
            title={page.editLocked ? lockMessage : 'Edit'}
            className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ti ti-edit text-sm" />
            <span>Edit</span>
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => onDelete(page.id)}
            disabled={page.editLocked}
            title={page.editLocked ? lockMessage : 'Delete'}
            className="flex-1 bg-white border border-red-100 text-red-600 hover:bg-red-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ti ti-trash text-sm" />
            <span>Delete</span>
          </button>
        )}
        <button
          onClick={() => onPreview(page.id)}
          className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-all"
        >
          <i className="ti ti-eye text-sm" />
          <span>Preview</span>
        </button>
      </div>
    </div>
  )
}

function CreateCard({ onClick }) {
  return (
    <div
      onClick={onClick}
      className="border border-dashed border-gray-200 hover:border-gray-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer h-80 transition-all select-none text-gray-400 hover:text-gray-600 bg-white"
    >
      <i className="ti ti-plus text-3xl" />
      <span className="text-sm font-semibold">Buat landing page baru</span>
    </div>
  )
}

/* ─── Browser Sandbox Preview ────────────────────────────────────────── */

function BrowserPreview({ html, redirectUrl }) {
  const [viewport, setViewport] = useState('desktop') // 'desktop', 'tablet', 'mobile'

  const widthClass = {
    desktop: 'w-full max-w-5xl',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]'
  }[viewport]

  return (
    <div className="w-full flex flex-col items-center space-y-4 animate-fade-in">
      {/* Viewport Control Bar */}
      <div className="flex items-center justify-between w-full max-w-5xl bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-500 mr-2">Viewport:</span>
          <button
            onClick={() => setViewport('desktop')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              viewport === 'desktop' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <i className="ti ti-device-desktop text-sm" /> Desktop
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              viewport === 'tablet' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <i className="ti ti-device-tablet text-sm" /> Tablet (768px)
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={clsx(
              'px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
              viewport === 'mobile' ? 'bg-violet-50 text-violet-600' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <i className="ti ti-device-mobile text-sm" /> Mobile (375px)
          </button>
        </div>
        <div className="text-gray-400 select-none text-[10px] flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live Sandbox
        </div>
      </div>

      {/* Browser Shell */}
      <div className={clsx("bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col transition-all duration-300", widthClass)}>
        {/* Browser Header */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          {/* Dot buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="w-3 h-3 rounded-full bg-red-400" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          {/* Address bar */}
          <div className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex items-center gap-2 flex-1 text-xs text-gray-500 select-none font-mono">
            <i className="ti ti-lock text-emerald-600" />
            <span className="truncate">{redirectUrl || 'https://portal.office.com'}</span>
          </div>
        </div>

        {/* Content iframe */}
        <div className="bg-gray-50 p-4 min-h-[500px] flex items-center justify-center w-full">
          <iframe
            srcDoc={html || '<h3>No HTML content</h3>'}
            title="Landing Page Preview"
            className="w-full min-h-[480px] bg-white border border-gray-200/80 rounded-lg shadow-sm"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  )
}

function PreviewFallback() {
  return (
    <div className="text-center text-gray-400 space-y-2 py-12">
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
  const title = editingName ? `Edit: ${editingName}` : 'Buat landing page'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Konfigurasi template HTML untuk menangkap input kredensial simulasi
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
        {/* Left settings panel (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Konfigurasi template
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">Nama template *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Microsoft 365 Login"
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-950 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-semibold text-gray-700">
                Redirect URL (setelah submit)
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://..."
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

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={captureData}
                  onChange={(e) => setCaptureData(e.target.checked)}
                  className="mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                />
                <div>
                  <span className="block font-semibold text-gray-900">Capture submitted data</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    Tangkap data parameter input yang dimasukkan user target
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={capturePass}
                  onChange={(e) => setCapturePass(e.target.checked)}
                  className="mt-0.5 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                />
                <div>
                  <span className="block font-semibold text-gray-900">Capture passwords</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">
                    Tangkap input password (direkomendasikan dalam mode terenkripsi)
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Code editor panel (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="text-gray-500 font-mono ml-2">template.html</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 select-none">
                {htmlCode.split('\n').length} baris
              </span>
              <span className="text-gray-400 select-none">HTML Source</span>
            </div>
          </div>

          {/* Functional Code Editor */}
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} height={420} />
        </div>
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
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const defaultEntity = useMemo(() => assetEntityForUser(currentUser), [currentUser])
  const canCreateAssets = useMemo(() => canUserCreateAsset(currentUser), [currentUser])
  const entityLocked = !canManagePukat(currentUser.role)

  useEffect(() => {
    const visiblePages = filterAssetsForUser(
      masterPages.map(masterLandingPageToUiPage),
      currentUser
    )
    setPages(visiblePages)
  }, [currentUser, masterPages])

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
      status: 'Published',
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

  /* ── Tab button classes ── */
  const tabBtnClass = (tab) =>
    clsx(
      'landing-tab-btn flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-sm transition-all focus:outline-none select-none',
      activeTab === tab
        ? 'border-violet-500 text-violet-500'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    )

  /* ── Filter pill classes ── */
  const pillClass = (key) =>
    clsx(
      'landing-filter-pill px-4 py-1.5 rounded-full text-xs font-semibold transition-all select-none',
      activeFilter === key
        ? 'bg-gray-950 text-white'
        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
    )

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      {/* ── Header ── */}
      <PageHeader
        title="Landing pages"
        subtitle="Dikelola dari master database"
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
                placeholder="Cari landing page..."
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
                <span>Buat landing page</span>
              </Button>
            )}
          </>
        }
      />

      {/* ── Sub Tab Bar ── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6 -mb-px" aria-label="Landing page subtabs">
          <button onClick={() => switchTab('list')} className={tabBtnClass('list')}>
            <i className="ti ti-list text-base" />
            <span>Daftar landing page</span>
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

            {/* Landing Pages Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading && (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
                  Memuat landing page dari master database...
                </div>
              )}
              {!isLoading && filteredPages.map((page) => (
                <LandingPageCard
                  key={page.id}
                  page={page}
                  canEdit={canUserEditAsset(page, currentUser)}
                  onEdit={handleEdit}
                  onPreview={handlePreview}
                  onDelete={handleDelete}
                />
              ))}
              {canCreateAssets && <CreateCard onClick={handleCreate} />}
            </div>
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
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Menampilkan simulasi tampilan persis di mata korban target
                </p>
              </div>
              <button
                onClick={() => switchTab('list')}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
              >
                Kembali ke daftar
              </button>
            </div>

            {/* Preview Viewport */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100 flex flex-col items-center justify-center p-6 min-h-[450px]">
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
    </div>
  )
}
