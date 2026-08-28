import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import { AssetEditorLayout, BrowserPreview } from '../../features/assets/components/index.js'
import { DataTable } from '../../components/DataTable/index.js'
import { resolveRowActions } from '../../components/DataTable/actionRegistry.js'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import Badge from '../../components/UI/Badge.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
import { useMasterLandingPages } from '../../hooks/queries/useMasterAssetQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import {
  useApproveMasterLandingPageVersionMutation,
  useAssignMasterLandingPageEntityMutation,
  useCreateMasterLandingPageMutation,
  useDeleteMasterLandingPageMutation,
  useDuplicateMasterLandingPageMutation,
  useUpdateMasterLandingPageMutation,
} from '../../hooks/mutations/useMasterAssetMutations.js'
import useAppStore from '../../store/useAppStore.js'
import { applyAssignmentFromEntity, entityFromAssignment, userForAssignmentPanel } from '../../utils/entityAssignmentHelpers.js'
import { buildMasterLandingPagePayload, masterAssetLockMessage, masterLandingPageToUiPage } from '../../utils/masterAssetHelpers.js'


const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Sign in to your account</title>
  <style>
    body { margin:0; font-family:sans-serif; background:#f3f4f6; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { width:380px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:32px; }
    input { width:100%; box-sizing:border-box; border:1px solid #d1d5db; border-radius:6px; padding:8px 12px; margin-bottom:12px; }
    button { width:100%; background:#2563eb; color:#fff; border:none; border-radius:6px; padding:10px; font-weight:700; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Sign In</h2>
    <form action="" method="POST">
      <input type="email" name="email" placeholder="Email" />
      <input type="password" name="password" placeholder="Password" />
      <button type="submit">Continue</button>
    </form>
  </div>
</body>
</html>`

const INITIAL_PAGES = []
const TABLE_KEY = 'landing_pages'
const DEFAULT_TABLE_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 25, filters: {} }

function CaptureBadge({ label }) {
  const isPass = label === 'Pass'
  return <Badge tone={isPass ? 'danger' : 'success'} className="text-[9px]">{label} ✓</Badge>
}

function HtmlEditor({ value, onChange }) {
  const lineCount = value.split('\n').length

  return (
    <div className="relative flex h-[420px] bg-[#1e1e1e] font-mono text-[11px] text-gray-300">
      <div className="w-12 flex-shrink-0 select-none overflow-hidden border-r border-gray-800 px-3 py-4 text-right text-gray-600">
        {Array.from({ length: lineCount }, (_, index) => (
          <div key={index} className="leading-relaxed">{index + 1}</div>
        ))}
      </div>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        spellCheck={false}
        className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-[11px] leading-relaxed text-gray-200 outline-none"
      />
    </div>
  )
}

const SUBTABS = [
  { key: 'list', label: 'Landing page list', icon: 'ti-list' },
  { key: 'editor', label: 'Editor', icon: 'ti-edit' },
  { key: 'preview', label: 'Preview', icon: 'ti-eye' },
]

export default function MasterLandingPages() {
  const { data: masterPages = [], isFetching, refetch } = useMasterLandingPages()
  const { data: usersData } = useUsers({ per_page: 100 })
  const [pages, setPages] = useState(() => INITIAL_PAGES.slice(0, 0))
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [activeTab, setActiveTab] = useState('list')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [editingEntity, setEditingEntity] = useState('')
  const [editingRedirectUrl, setEditingRedirectUrl] = useState('https://portal.office.com')
  const [editingCaptureData, setEditingCaptureData] = useState(true)
  const [editingCapturePass, setEditingCapturePass] = useState(true)
  const [previewTitle, setPreviewTitle] = useState('Microsoft 365 Login')
  const [assignmentPageId, setAssignmentPageId] = useState(null)
  const [deletingPageId, setDeletingPageId] = useState(null)
  const [approvingPageId, setApprovingPageId] = useState(null)
  const canApproveLandingPages = useAppStore(state => state.hasPermission('master_landing_pages.approve'))
  const currentUser = useAppStore(state => state.user)

  const { data: schema } = useTableSchema(TABLE_KEY)
  const { data: rowsData, isLoading, isFetching: isFetchingRows, refetch: refetchRows } = useTableRows(TABLE_KEY, {
    search: tableState.search,
    sort: tableState.sort,
    order: tableState.order,
    page: tableState.page,
    per_page: tableState.perPage,
    filters: tableState.filters,
  })

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(userForAssignmentPanel)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const entityCount = new Set(pages.map(page => page.entity).filter(Boolean)).size
  const noEntityCount = pages.filter(page => !page.entity).length

  const tableRows = useMemo(
    () => (rowsData?.rows || []).map(row => applyAssignmentFromEntity(row, users)),
    [rowsData, users]
  )

  // "Preview" as the always-visible primary action, everything else (Assign/Edit/
  // Duplicate/Delete) tucked into a "More Actions" kebab menu — replaces the shared
  // DataTable action cell's default inline-buttons layout for this page only.
  function renderActionsCell(row) {
    const resolved = resolveRowActions(row.row_actions)
    const previewAction = resolved.find(action => action.key === 'preview')
    const menuItems = resolved.filter(action => action.key !== 'preview')

    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        {previewAction && (
          <Button
            variant="secondary"
            size="sm"
            disabled={previewAction.disabled}
            title={previewAction.disabled ? previewAction.reason : 'Preview'}
            onClick={() => handleRowAction({ actionKey: 'preview', row })}
          >
            <i className={clsx('ti', previewAction.icon)} />
            Preview
          </Button>
        )}
        <TableActionMenu
          items={menuItems}
          triggerTitle="More Actions"
          onSelect={actionKey => handleRowAction({ actionKey, row })}
        />
      </div>
    )
  }

  const columns = useMemo(() => {
    const merged = []
    ;(schema?.columns || []).forEach(column => {
      if ('actions' === column.renderer) {
        merged.push({ ...column, renderer: 'custom', render: row => renderActionsCell(row) })
        return
      }
      merged.push(column)
      if (column.key === 'category') {
        merged.push({
          key: 'capture',
          label: 'Capture',
          renderer: 'custom',
          render: row => (
            <div className="flex flex-wrap gap-1.5">
              {row.capture_credentials && <CaptureBadge label="Data" />}
              {row.capture_passwords && <CaptureBadge label="Pass" />}
            </div>
          ),
        })
        merged.push({
          key: 'assignment',
          label: 'Assignment',
          renderer: 'custom',
          render: row => <AssignmentBadge item={row} usersById={usersById} />,
        })
      }
    })
    return merged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, usersById])

  const resetEditor = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingHtml('')
    setEditingEntity('')
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
  }, [])

  const switchTab = useCallback((tab) => {
    setActiveTab(tab)
    if (tab === 'list') resetEditor()
  }, [resetEditor])

  const closeEditor = useCallback(() => {
    switchTab('list')
  }, [switchTab])

  const createMutation = useCreateMasterLandingPageMutation({ onSuccess: closeEditor })
  const updateMutation = useUpdateMasterLandingPageMutation({ onSuccess: closeEditor })
  const deleteMutation = useDeleteMasterLandingPageMutation({
    onSuccess: () => setDeletingPageId(null),
  })
  const assignEntityMutation = useAssignMasterLandingPageEntityMutation({
    onSuccess: () => setAssignmentPageId(null),
  })
  const approveMutation = useApproveMasterLandingPageVersionMutation({
    onSuccess: () => setApprovingPageId(null),
  })
  const duplicateMutation = useDuplicateMasterLandingPageMutation()
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  useEffect(() => {
    setPages(masterPages
      .map(masterLandingPageToUiPage)
      .map(page => applyAssignmentFromEntity(page, users))
    )
  }, [masterPages, users])

  const assignmentPage = useMemo(() => (
    pages.find(page => page.id === assignmentPageId) ?? null
  ), [assignmentPageId, pages])
  const deletingPage = useMemo(() => (
    pages.find(page => page.id === deletingPageId) ?? null
  ), [deletingPageId, pages])
  const approvingPage = useMemo(() => (
    pages.find(page => page.id === approvingPageId) ?? null
  ), [approvingPageId, pages])
  const editingPage = useMemo(() => (
    pages.find(page => page.id === editingId) ?? null
  ), [editingId, pages])
  const canApproveEditingPage = Boolean(
    editingPage
    && canApproveLandingPages
    && editingPage.status !== 'Published'
    && Number(currentUser.id) !== Number(editingPage.versionCreatedBy)
    && Number(currentUser.id) !== Number(editingPage.versionUpdatedBy)
  )

  const handleCreate = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingHtml(DEFAULT_HTML)
    setEditingEntity('')
    setEditingRedirectUrl('https://portal.office.com')
    setEditingCaptureData(true)
    setEditingCapturePass(true)
    setActiveTab('editor')
  }, [])

  const handleEdit = useCallback((id) => {
    const page = pages.find(item => item.id === id)
    if (!page) return
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
  }, [pages])

  const handlePreview = useCallback((id) => {
    const page = pages.find(item => item.id === id)
    if (!page) return
    setEditingId(page.id)
    setEditingName(page.name)
    setEditingHtml(page.html || '')
    setEditingEntity(page.entity || '')
    setEditingRedirectUrl(page.redirectUrl || 'https://portal.office.com')
    setEditingCaptureData(page.badges?.includes('Data') ?? true)
    setEditingCapturePass(page.badges?.includes('Pass') ?? true)
    setPreviewTitle(page.name)
    setActiveTab('preview')
  }, [pages])

  const handleAssign = useCallback((id) => {
    // Assign is never blocked by Campaign/Playbook usage.
    setAssignmentPageId(id)
  }, [])

  const handleDuplicate = useCallback((id) => {
    // Clone is never blocked by Campaign/Playbook usage — it creates a brand-new row.
    const page = pages.find(item => item.id === id)
    if (!page) return

    duplicateMutation.mutate({
      id,
      data: { name: `Copy of ${page.name}`, entity: page.entity || '' },
    })
  }, [duplicateMutation, pages])

  const handleDelete = useCallback((id) => {
    const page = pages.find(item => item.id === id)
    if (!page) return
    if (page.editLocked) {
      toast.error(masterAssetLockMessage(page, 'Landing page'))
      return
    }

    setDeletingPageId(id)
  }, [pages])

  const confirmDelete = useCallback(() => {
    if (!deletingPage) return
    if (deletingPage.editLocked) {
      toast.error(masterAssetLockMessage(deletingPage, 'Landing page'))
      setDeletingPageId(null)
      return
    }

    deleteMutation.mutate(deletingPage.id)
  }, [deleteMutation, deletingPage])

  const handleApprove = useCallback((id) => {
    setApprovingPageId(id)
  }, [])

  const confirmApprove = useCallback(() => {
    if (!approvingPage) return
    approveMutation.mutate(approvingPage.versionId)
  }, [approveMutation, approvingPage])

  function handleSave() {
    const currentPage = pages.find(page => page.id === editingId)
    if (currentPage?.editLocked) {
      toast.error(masterAssetLockMessage(currentPage, 'Landing page'))
      return
    }

    const name = editingName.trim()
    if (!name || !editingHtml.trim()) {
      toast.error('Name and HTML source are required.')
      return
    }

    const payload = buildMasterLandingPagePayload({
      name: editingName,
      html: editingHtml,
      redirectUrl: editingRedirectUrl,
      entity: editingEntity,
      captureData: editingCaptureData,
      capturePass: editingCapturePass,
    })

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const saveAssignment = useCallback((assignment) => {
    if (!assignmentPage) return
    // Assign is never blocked by Campaign/Playbook usage.

    const result = entityFromAssignment(assignment, users)
    if (result.error) {
      toast.error(result.error)
      return
    }

    assignEntityMutation.mutate({
      id: assignmentPage.id,
      entity: result.entity,
    })
  }, [assignEntityMutation, assignmentPage, users])

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'assign') handleAssign(row.id)
    else if (actionKey === 'edit') handleEdit(row.id)
    else if (actionKey === 'preview') handlePreview(row.id)
    else if (actionKey === 'duplicate') handleDuplicate(row.id)
    else if (actionKey === 'delete') handleDelete(row.id)
  }

  async function syncGoPhish() {
    const [result] = await Promise.all([refetch(), refetchRows()])
    if (result.error) {
      toast.error(result.error.message || 'Failed to refresh landing page masters.')
      return
    }
    toast.success(`Refresh complete - ${result.data?.length ?? 0} landing page masters`)
  }

  return (
    <PageShell>
      <PageHeader
        title="Master landing pages"
        subtitle="WordPress-owned landing page masters grouped by entity."
        actions={
          <>
            <Button variant="outline" onClick={syncGoPhish} disabled={isFetching}>
              <i className={clsx('ti ti-refresh text-base', isFetching && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              <i className="ti ti-plus text-base" />
              <span>Create landing page</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <i className="ti ti-browser text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{pages.length}</div>
            <div className="text-xs font-semibold text-gray-500">Master assets</div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{entityCount}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">Entities</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{noEntityCount}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">Without entity</div>
        </div>
      </div>

      <Tabs items={SUBTABS} active={activeTab} onChange={switchTab} ariaLabel="Landing page subtabs" />

      <div className="space-y-6 overflow-y-auto pb-4">
        {activeTab === 'list' && (
          <div className="space-y-6 animate-fade-in">
            <DataTable
              tableKey={TABLE_KEY}
              schema={schema ? { ...schema, columns } : schema}
              rows={tableRows}
              meta={rowsData?.meta}
              state={tableState}
              loading={isLoading}
              refetching={isFetchingRows}
              onStateChange={setTableState}
              onRowAction={handleRowAction}
            />
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingId ? `Edit: ${editingName}` : 'Create landing page'}</h2>
                <p className="mt-0.5 text-xs text-gray-500">Configure the HTML template and capture behavior.</p>
              </div>
              <div className="flex items-center gap-3">
                {canApproveEditingPage && (
                  <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => handleApprove(editingId)}>
                    <i className="ti ti-shield-check text-base" />
                    <span>Approve</span>
                  </Button>
                )}
                <Button variant="outline" onClick={() => switchTab('list')}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save template'}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
                <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">Template configuration</h3>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-gray-700">Template name *</span>
                  <input value={editingName} onChange={event => setEditingName(event.target.value)} placeholder="Example: Microsoft 365 Login" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-gray-700">Redirect URL after submit</span>
                  <input value={editingRedirectUrl} onChange={event => setEditingRedirectUrl(event.target.value)} placeholder="https://..." className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-gray-700">Entity</span>
                  <input value={editingEntity} onChange={event => setEditingEntity(event.target.value)} placeholder="Example: EntityA" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
                </label>
                {editingId && editingPage && (
                  <div className="block space-y-1 text-xs">
                    <span className="font-semibold text-gray-700">Status</span>
                    <div className="pt-1.5">
                      <Badge tone={editingPage.status === 'Published' ? 'success' : 'gray'}>{editingPage.status}</Badge>
                    </div>
                  </div>
                )}
                <div className="space-y-3 pt-2 text-xs">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={editingCaptureData} onChange={event => setEditingCaptureData(event.target.checked)} className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                    <span>
                      <span className="block font-semibold text-gray-900">Capture submitted data</span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">Capture parameters entered by the target user.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input type="checkbox" checked={editingCapturePass} onChange={event => setEditingCapturePass(event.target.checked)} className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                    <span>
                      <span className="block font-semibold text-gray-900">Capture passwords</span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">Capture password inputs for controlled simulations.</span>
                    </span>
                  </label>
                </div>
              </div>
              <AssetEditorLayout fileName="template.html" lineCount={editingHtml.split('\n').length}>
                <HtmlEditor value={editingHtml} onChange={setEditingHtml} />
              </AssetEditorLayout>
            </div>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="mt-0.5 text-xs text-gray-500">Preview how the landing page appears to the target.</p>
              </div>
              <Button variant="outline" onClick={() => switchTab('list')}>Back to list</Button>
            </div>
            <div className="flex min-h-[450px] flex-col items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100 p-6">
              {editingHtml ? (
                <BrowserPreview html={editingHtml} redirectUrl={editingRedirectUrl} />
              ) : (
                <div className="space-y-2 py-12 text-center text-gray-400">
                  <i className="ti ti-eye-off text-3xl" />
                  <p className="text-xs font-medium">Select a landing page to preview or open the editor.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {assignmentPage && (
        <AssignmentPanel
          key={assignmentPage.id}
          item={assignmentPage}
          resourceLabel="asset"
          users={users}
          onClose={() => setAssignmentPageId(null)}
          onSave={saveAssignment}
        />
      )}
      {deletingPage && (
        <AlertConfirmation
          title="Delete landing page?"
          message={`"${deletingPage.name}" will be deleted from the master landing page library.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingPageId(null)}
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
          onCancel={() => setApprovingPageId(null)}
          onConfirm={confirmApprove}
        />
      )}
    </PageShell>
  )
}
