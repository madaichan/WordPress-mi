import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import ClientPreview from '../../components/Editor/ClientPreview.jsx'
import { AssetEditorLayout } from '../../features/assets/components/index.js'
import { DataTable } from '../../components/DataTable/index.js'
import { resolveRowActions } from '../../components/DataTable/actionRegistry.js'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import Badge from '../../components/UI/Badge.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
import { useMasterEmailTemplates } from '../../hooks/queries/useMasterAssetQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import {
  useApproveMasterEmailTemplateVersionMutation,
  useAssignMasterEmailTemplateEntityMutation,
  useCreateMasterEmailTemplateMutation,
  useDeleteMasterEmailTemplateMutation,
  useDuplicateMasterEmailTemplateMutation,
  useUpdateMasterEmailTemplateMutation,
} from '../../hooks/mutations/useMasterAssetMutations.js'
import useAppStore from '../../store/useAppStore.js'
import { applyAssignmentFromEntity, entityFromAssignment, userForAssignmentPanel } from '../../utils/entityAssignmentHelpers.js'
import { buildMasterEmailTemplatePayload, masterAssetLockMessage, masterEmailTemplateToUiTemplate } from '../../utils/masterAssetHelpers.js'


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
    <h3>Unusual Account Activity</h3>
    <p>Hello {{.FirstName}},</p>
    <p>We detected an unknown sign-in attempt on your account.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="{{.URL}}" class="btn">Verify Account</a>
    </div>
  </div>
</body>
</html>`

const INITIAL_TEMPLATES = []
const TABLE_KEY = 'email_templates'
const DEFAULT_TABLE_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 25, filters: {} }

function PreviewFallback() {
  return (
    <div className="space-y-2 py-12 text-center text-gray-400">
      <i className="ti ti-mail-opened text-3xl" />
      <p className="text-xs font-medium">
        Select a template from the list or open the editor to preview an email.
      </p>
    </div>
  )
}

function EditorPane({
  editingName,
  currentTemplate,
  name,
  setName,
  category,
  setCategory,
  sender,
  setSender,
  entity,
  setEntity,
  subject,
  setSubject,
  htmlCode,
  setHtmlCode,
  saving,
  canApprove,
  onBack,
  onSave,
  onApprove,
}) {
  const title = editingName ? `Edit template: ${editingName}` : 'Create email template'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">Configure master metadata and the versioned email HTML source.</p>
        </div>
        <div className="flex items-center gap-3">
          {canApprove && (
            <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={onApprove}>
              <i className="ti ti-shield-check text-base" />
              <span>Approve</span>
            </Button>
          )}
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save template'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">Envelope headers</h3>
          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <span className="block font-semibold text-gray-700">Template name *</span>
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Example: Microsoft O365 Alert" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="block font-semibold text-gray-700">Category</span>
                <select value={category} onChange={event => setCategory(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500">
                  <option value="alert">Security alert</option>
                  <option value="info">Internal info</option>
                  <option value="urgent">Urgent notification</option>
                </select>
              </label>
              {editingName && currentTemplate && (
                <div className="block space-y-1">
                  <span className="block font-semibold text-gray-700">Status</span>
                  <div className="pt-1.5">
                    <Badge tone={currentTemplate.status === 'Published' ? 'success' : 'gray'}>{currentTemplate.status}</Badge>
                  </div>
                </div>
              )}
            </div>
            <label className="block space-y-1">
              <span className="block font-semibold text-gray-700">Preview sender</span>
              <input value={sender} onChange={event => setSender(event.target.value)} placeholder="Example: Admin <admin@company.id>" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
            </label>
            <label className="block space-y-1">
              <span className="block font-semibold text-gray-700">Entity</span>
              <input value={entity} onChange={event => setEntity(event.target.value)} placeholder="Example: EntityA" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
            </label>
            <label className="block space-y-1">
              <span className="block font-semibold text-gray-700">Subject *</span>
              <input value={subject} onChange={event => setSubject(event.target.value)} placeholder="Email subject" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
            </label>
            <div className="pt-2">
              <span className="mb-1.5 block font-semibold text-gray-900">Dynamic variables</span>
              <p className="text-[10px] leading-relaxed text-gray-400">Use these GoPhish placeholders for automatic personalization:</p>
              <div className="mt-2 grid select-all grid-cols-2 gap-1.5 font-mono text-[9px] text-gray-600">
                {['{{.FirstName}}', '{{.Email}}', '{{.URL}} (Phish Link)', '{{.Position}}'].map(variable => (
                  <div key={variable} className="rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-center">
                    {variable}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AssetEditorLayout fileName="email_source.html" lineCount={htmlCode.split('\n').length} elevated>
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} />
        </AssetEditorLayout>
      </div>
    </div>
  )
}

const SUBTABS = [
  { key: 'list', label: 'Template list', icon: 'ti-list' },
  { key: 'editor', label: 'Editor', icon: 'ti-edit' },
  { key: 'preview', label: 'Preview', icon: 'ti-eye' },
]

export default function MasterEmailTemplates() {
  const { data: masterTemplates = [], isFetching, refetch } = useMasterEmailTemplates()
  const { data: usersData } = useUsers({ per_page: 100 })
  const [templates, setTemplates] = useState(() => INITIAL_TEMPLATES.slice(0, 0))
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [activeTab, setActiveTab] = useState('list')
  const [previewTitle, setPreviewTitle] = useState('Microsoft Office 365 Alert')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingCategory, setEditingCategory] = useState('alert')
  const [editingSender, setEditingSender] = useState('')
  const [editingEntity, setEditingEntity] = useState('')
  const [editingSubject, setEditingSubject] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [assignmentTemplateId, setAssignmentTemplateId] = useState(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState(null)
  const [approvingTemplateId, setApprovingTemplateId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const canApproveEmailTemplates = useAppStore(state => state.hasPermission('master_email_templates.approve'))
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

  const entityCount = new Set(templates.map(template => template.entity).filter(Boolean)).size
  const noEntityCount = templates.filter(template => !template.entity).length

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

  const clearEditingState = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingCategory('alert')
    setEditingSender('')
    setEditingEntity('')
    setEditingSubject('')
    setEditingHtml('')
  }, [])

  const switchTab = useCallback((tab) => {
    setActiveTab(tab)
    if (tab === 'list') clearEditingState()
  }, [clearEditingState])

  const closeEditor = useCallback(() => {
    switchTab('list')
  }, [switchTab])

  const createMutation = useCreateMasterEmailTemplateMutation({ onSuccess: closeEditor })
  const updateMutation = useUpdateMasterEmailTemplateMutation({ onSuccess: closeEditor })
  const deleteMutation = useDeleteMasterEmailTemplateMutation({
    onSuccess: () => setDeletingTemplateId(null),
  })
  const assignEntityMutation = useAssignMasterEmailTemplateEntityMutation({
    onSuccess: () => setAssignmentTemplateId(null),
  })
  const approveMutation = useApproveMasterEmailTemplateVersionMutation({
    onSuccess: () => setApprovingTemplateId(null),
  })
  const duplicateMutation = useDuplicateMasterEmailTemplateMutation()
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  useEffect(() => {
    setTemplates(masterTemplates
      .map(masterEmailTemplateToUiTemplate)
      .map(template => applyAssignmentFromEntity(template, users))
    )
  }, [masterTemplates, users])

  const assignmentTemplate = useMemo(() => (
    templates.find(template => template.id === assignmentTemplateId) ?? null
  ), [assignmentTemplateId, templates])
  const deletingTemplate = useMemo(() => (
    templates.find(template => template.id === deletingTemplateId) ?? null
  ), [deletingTemplateId, templates])
  const approvingTemplate = useMemo(() => (
    templates.find(template => template.id === approvingTemplateId) ?? null
  ), [approvingTemplateId, templates])
  const editingTemplate = useMemo(() => (
    templates.find(template => template.id === editingId) ?? null
  ), [editingId, templates])
  const canApproveEditingTemplate = Boolean(
    editingTemplate
    && canApproveEmailTemplates
    && editingTemplate.status !== 'Published'
    && Number(currentUser.id) !== Number(editingTemplate.versionCreatedBy)
    && Number(currentUser.id) !== Number(editingTemplate.versionUpdatedBy)
  )

  const loadTemplateForWork = useCallback((id) => {
    const template = templates.find(item => item.id === id)
    if (!template) return null

    setEditingId(template.id)
    setEditingName(template.name)
    setEditingCategory(template.category || 'alert')
    setEditingSender(template.sender || '')
    setEditingEntity(template.entity || '')
    setEditingSubject(template.subject || '')
    setEditingHtml(template.html || '')
    return template
  }, [templates])

  const handleEdit = useCallback((id) => {
    const template = templates.find(item => item.id === id)
    if (template?.editLocked) {
      toast.error(masterAssetLockMessage(template, 'Email template'))
      return
    }

    if (loadTemplateForWork(id)) setActiveTab('editor')
  }, [loadTemplateForWork, templates])

  const handlePreview = useCallback((id) => {
    const template = loadTemplateForWork(id)
    if (!template) return
    setPreviewTitle(template.name)
    setActiveTab('preview')
  }, [loadTemplateForWork])

  const handleCreate = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingCategory('alert')
    setEditingSender('Admin <admin@company.id>')
    setEditingEntity('')
    setEditingSubject('Action Required: Important Notification')
    setEditingHtml(DEFAULT_HTML)
    setActiveTab('editor')
  }, [])

  const handleAssign = useCallback((id) => {
    // Assign is never blocked by Campaign/Playbook usage.
    setAssignmentTemplateId(id)
  }, [])

  const handleDuplicate = useCallback((id) => {
    // Clone is never blocked by Campaign/Playbook usage — it creates a brand-new row.
    const template = templates.find(item => item.id === id)
    if (!template) return

    duplicateMutation.mutate({
      id,
      data: { name: `Copy of ${template.name}`, entity: template.entity || '' },
    })
  }, [duplicateMutation, templates])

  const handleDelete = useCallback((id) => {
    const template = templates.find(item => item.id === id)
    if (!template) return
    if (template.editLocked) {
      toast.error(masterAssetLockMessage(template, 'Email template'))
      return
    }

    setDeletingTemplateId(id)
  }, [templates])

  const confirmDelete = useCallback(() => {
    if (!deletingTemplate) return
    if (deletingTemplate.editLocked) {
      toast.error(masterAssetLockMessage(deletingTemplate, 'Email template'))
      setDeletingTemplateId(null)
      return
    }

    deleteMutation.mutate(deletingTemplate.id)
  }, [deleteMutation, deletingTemplate])

  const handleApprove = useCallback((id) => {
    setApprovingTemplateId(id)
  }, [])

  const confirmApprove = useCallback(() => {
    if (!approvingTemplate) return
    approveMutation.mutate(approvingTemplate.versionId)
  }, [approveMutation, approvingTemplate])

  const handleSave = useCallback(() => {
    const currentTemplate = templates.find(template => template.id === editingId)
    if (currentTemplate?.editLocked) {
      toast.error(masterAssetLockMessage(currentTemplate, 'Email template'))
      return
    }

    if (!editingName.trim() || !editingSubject.trim() || !editingHtml.trim()) {
      toast.error('Template name, subject, and HTML source are required.')
      return
    }

    const payload = buildMasterEmailTemplatePayload({
      name: editingName,
      category: editingCategory,
      entity: editingEntity,
      subject: editingSubject,
      html: editingHtml,
    })

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [createMutation, editingCategory, editingEntity, editingHtml, editingId, editingName, editingSubject, templates, updateMutation])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    const [result] = await Promise.all([refetch(), refetchRows()])
    setSyncing(false)

    if (result.error) {
      toast.error(result.error.message || 'Failed to refresh email template masters.')
      return
    }

    toast.success(`Refresh complete - ${result.data?.length ?? 0} email template masters`)
  }, [refetch, refetchRows])

  const saveAssignment = useCallback((assignment) => {
    if (!assignmentTemplate) return
    // Assign is never blocked by Campaign/Playbook usage.

    const result = entityFromAssignment(assignment, users)
    if (result.error) {
      toast.error(result.error)
      return
    }

    assignEntityMutation.mutate({
      id: assignmentTemplate.id,
      entity: result.entity,
    })
  }, [assignEntityMutation, assignmentTemplate, users])

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'assign') handleAssign(row.id)
    else if (actionKey === 'edit') handleEdit(row.id)
    else if (actionKey === 'preview') handlePreview(row.id)
    else if (actionKey === 'duplicate') handleDuplicate(row.id)
    else if (actionKey === 'delete') handleDelete(row.id)
  }

  return (
    <PageShell>
      <PageHeader
        title="Master email templates"
        subtitle="Manage WordPress-owned email template masters by entity."
        actions={
          <>
            <Button variant="outline" onClick={handleSync} disabled={syncing || isFetching}>
              <i className={clsx('ti ti-refresh text-base', (syncing || isFetching) && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button variant="primary" onClick={handleCreate}>
              <i className="ti ti-plus text-base" />
              <span>Create email template</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <i className="ti ti-mail text-xl" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{templates.length}</div>
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

      <Tabs items={SUBTABS} active={activeTab} onChange={switchTab} ariaLabel="Email template subtabs" />

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
          <EditorPane
            editingName={editingId ? editingName : ''}
            currentTemplate={editingTemplate}
            name={editingName}
            setName={setEditingName}
            category={editingCategory}
            setCategory={setEditingCategory}
            sender={editingSender}
            setSender={setEditingSender}
            entity={editingEntity}
            setEntity={setEditingEntity}
            subject={editingSubject}
            setSubject={setEditingSubject}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
            saving={saving}
            canApprove={canApproveEditingTemplate}
            onApprove={() => handleApprove(editingId)}
            onBack={() => switchTab('list')}
            onSave={handleSave}
          />
        )}

        {activeTab === 'preview' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewTitle}</h2>
                <p className="mt-0.5 text-xs text-gray-500">Preview how this template appears in the target email client.</p>
              </div>
              <Button variant="outline" onClick={() => switchTab('list')}>Back to list</Button>
            </div>
            <div className="flex min-h-[450px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-6">
              {editingHtml ? (
                <ClientPreview
                  html={editingHtml}
                  sender={editingSender}
                  subject={editingSubject}
                  timestampLabel="Today, 10:24 AM"
                  recipientLabel="{{.Email}} (Target Employee)"
                />
              ) : (
                <PreviewFallback />
              )}
            </div>
          </div>
        )}
      </div>

      {assignmentTemplate && (
        <AssignmentPanel
          key={assignmentTemplate.id}
          item={assignmentTemplate}
          resourceLabel="asset"
          users={users}
          onClose={() => setAssignmentTemplateId(null)}
          onSave={saveAssignment}
        />
      )}
      {deletingTemplate && (
        <AlertConfirmation
          title="Delete email template?"
          message={`"${deletingTemplate.name}" will be deleted from the master email template library.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingTemplateId(null)}
          onConfirm={confirmDelete}
        />
      )}
      {approvingTemplate && (
        <AlertConfirmation
          title="Approve email template version?"
          message={`Approve the current version of "${approvingTemplate.name}"? It will become available for use in campaigns.`}
          icon="ti-shield-check"
          tone="warning"
          confirmLabel="Approve"
          pendingLabel="Approving..."
          isPending={approveMutation.isPending}
          onCancel={() => setApprovingTemplateId(null)}
          onConfirm={confirmApprove}
        />
      )}
    </PageShell>
  )
}
