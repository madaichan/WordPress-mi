import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import ClientPreview from '../../components/Editor/ClientPreview.jsx'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import TableActionButton from '../../components/UI/TableActionButton.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import Badge from '../../components/UI/Badge.jsx'
import { useMasterEmailTemplates } from '../../hooks/queries/useMasterAssetQueries.js'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import {
  useAssignMasterEmailTemplateEntityMutation,
  useCreateMasterEmailTemplateMutation,
  useDeleteMasterEmailTemplateMutation,
  useUpdateMasterEmailTemplateMutation,
} from '../../hooks/mutations/useMasterAssetMutations.js'
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

function StatusBadge({ status }) {
  const published = status === 'Published'
  return <Badge tone={published ? 'success' : 'warning'} className="text-[10px]">{status}</Badge>
}

function EmailTemplatesTable({ templates, usersById, onEdit, onPreview, onAssign, onDelete }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              <th className="p-4">Email template</th>
              <th className="p-4">Category</th>
              <th className="p-4">Sender</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Status</th>
              <th className="p-4">Assignment</th>
              <th className="p-4">Entity</th>
              <th className="w-40 p-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {templates.map(template => (
              <tr key={template.id} className="transition-colors hover:bg-gray-50/70">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <span className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm', template.thumbnail?.bg || 'bg-violet-100 text-violet-700')}>
                      <i className={clsx('ti', template.thumbnail?.icon || 'ti-mail')} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900">{template.name}</div>
                      <div className="mt-0.5 flex max-w-xs flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                        <span className="truncate">{template.description || template.id}</span>
                        {template.editLocked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700" title={masterAssetLockMessage(template, 'Email template')}>
                            <i className="ti ti-lock text-[10px]" />
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <Badge tone="gray" className="text-[10px] capitalize">
                    {template.category.replace('-', ' ')}
                  </Badge>
                </td>
                <td className="p-4">
                  <span className="block max-w-[180px] truncate text-[11px] font-medium text-gray-700">{template.sender || '-'}</span>
                </td>
                <td className="p-4">
                  <span className="block max-w-[220px] truncate text-[11px] text-gray-500">{template.subject}</span>
                </td>
                <td className="p-4">
                  <StatusBadge status={template.status} />
                </td>
                <td className="p-4">
                  <AssignmentBadge item={template} usersById={usersById} />
                </td>
                <td className="p-4">
                  <Badge tone={template.entity ? 'gray' : 'warning'} className="text-[10px]">
                    {template.entity || 'No entity'}
                  </Badge>
                </td>
                <td className="w-40 p-4 pr-6 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <TableActionButton
                      icon="ti-user-check"
                      label={`Assign ${template.name}`}
                      title={template.editLocked ? masterAssetLockMessage(template, 'Email template') : 'Assign'}
                      tone="green"
                      disabled={template.editLocked}
                      onClick={() => onAssign(template.id)}
                    />
                    <TableActionButton
                      icon="ti-edit"
                      label={`Edit ${template.name}`}
                      title={template.editLocked ? masterAssetLockMessage(template, 'Email template') : 'Edit'}
                      disabled={template.editLocked}
                      onClick={() => onEdit(template.id)}
                    />
                    <TableActionButton icon="ti-eye" label={`Preview ${template.name}`} title="Preview" tone="blue" onClick={() => onPreview(template.id)} />
                    <TableActionButton
                      icon="ti-trash"
                      label={`Delete ${template.name}`}
                      title={template.editLocked ? masterAssetLockMessage(template, 'Email template') : 'Delete'}
                      tone="red"
                      disabled={template.editLocked}
                      onClick={() => onDelete(template.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-sm text-gray-400">
                  No email templates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

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
  name,
  setName,
  category,
  setCategory,
  status,
  setStatus,
  sender,
  setSender,
  entity,
  setEntity,
  subject,
  setSubject,
  htmlCode,
  setHtmlCode,
  saving,
  onBack,
  onSave,
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
              <label className="block space-y-1">
                <span className="block font-semibold text-gray-700">Status</span>
                <select value={status} onChange={event => setStatus(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500">
                  <option>Published</option>
                  <option>Draft</option>
                </select>
              </label>
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

        <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="ml-2 font-mono text-gray-500">email_source.html</span>
            </div>
            <div className="flex items-center gap-3 text-gray-500">
              <span>{htmlCode.split('\n').length} lines</span>
              <span className="text-gray-400">HTML Source</span>
            </div>
          </div>
          <HtmlCodeEditor value={htmlCode} onChange={setHtmlCode} />
        </div>
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
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [previewTitle, setPreviewTitle] = useState('Microsoft Office 365 Alert')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingCategory, setEditingCategory] = useState('alert')
  const [editingStatus, setEditingStatus] = useState('Published')
  const [editingSender, setEditingSender] = useState('')
  const [editingEntity, setEditingEntity] = useState('')
  const [editingSubject, setEditingSubject] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [assignmentTemplateId, setAssignmentTemplateId] = useState(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(userForAssignmentPanel)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const filteredTemplates = useMemo(() => {
    let list = templates
    if (activeFilter !== 'all') {
      list = list.filter(template => template.category === activeFilter)
    }

    const query = searchQuery.trim().toLowerCase()
    if (!query) return list

    return list.filter(template => (
      template.name.toLowerCase().includes(query)
      || template.description.toLowerCase().includes(query)
      || template.sender.toLowerCase().includes(query)
      || template.entity.toLowerCase().includes(query)
      || template.subject.toLowerCase().includes(query)
    ))
  }, [activeFilter, searchQuery, templates])

  const categories = useMemo(() => ([
    { key: 'all', label: 'All', count: templates.length },
    { key: 'alert', label: 'Security alert', count: templates.filter(template => template.category === 'alert').length },
    { key: 'info', label: 'Internal info', count: templates.filter(template => template.category === 'info').length },
    { key: 'urgent', label: 'Urgent notification', count: templates.filter(template => template.category === 'urgent').length },
  ]), [templates])
  const entityCount = new Set(templates.map(template => template.entity).filter(Boolean)).size
  const noEntityCount = templates.filter(template => !template.entity).length

  const clearEditingState = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingCategory('alert')
    setEditingStatus('Published')
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
    setSearchQuery('')
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

  const loadTemplateForWork = useCallback((id) => {
    const template = templates.find(item => item.id === id)
    if (!template) return null

    setEditingId(template.id)
    setEditingName(template.name)
    setEditingCategory(template.category || 'alert')
    setEditingStatus(template.status || 'Published')
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
    setEditingStatus('Published')
    setEditingSender('Admin <admin@company.id>')
    setEditingEntity('')
    setEditingSubject('Action Required: Important Notification')
    setEditingHtml(DEFAULT_HTML)
    setActiveTab('editor')
  }, [])

  const handleAssign = useCallback((id) => {
    const template = templates.find(item => item.id === id)
    if (template?.editLocked) {
      toast.error(masterAssetLockMessage(template, 'Email template'))
      return
    }

    setAssignmentTemplateId(id)
  }, [templates])

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
      status: editingStatus,
      entity: editingEntity,
      subject: editingSubject,
      html: editingHtml,
    })

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }, [createMutation, editingCategory, editingEntity, editingHtml, editingId, editingName, editingStatus, editingSubject, templates, updateMutation])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    const result = await refetch()
    setSyncing(false)

    if (result.error) {
      toast.error(result.error.message || 'Failed to refresh email template masters.')
      return
    }

    toast.success(`Refresh complete - ${result.data?.length ?? 0} email template masters`)
  }, [refetch])

  const saveAssignment = useCallback((assignment) => {
    if (!assignmentTemplate) return
    if (assignmentTemplate.editLocked) {
      toast.error(masterAssetLockMessage(assignmentTemplate, 'Email template'))
      setAssignmentTemplateId(null)
      return
    }

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

  const pillClass = (key) =>
    clsx(
      'rounded-full px-4 py-1.5 text-xs font-semibold transition-all select-none',
      activeFilter === key
        ? 'bg-gray-950 text-white'
        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    )

  return (
    <div className="mt-4 space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden animate-fade-in">
      <PageHeader
        title="Master email templates"
        subtitle="Manage WordPress-owned email template masters by entity."
        actions={
          <>
            <div className="relative w-64">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <i className="ti ti-search text-base" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search templates..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-950 outline-none placeholder:text-gray-400 focus:border-violet-500"
              />
            </div>
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
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(category => (
                <button key={category.key} onClick={() => setActiveFilter(category.key)} className={pillClass(category.key)}>
                  {category.label} ({category.count})
                </button>
              ))}
            </div>
            <EmailTemplatesTable
              templates={filteredTemplates}
              usersById={usersById}
              onEdit={handleEdit}
              onPreview={handlePreview}
              onAssign={handleAssign}
              onDelete={handleDelete}
            />
          </div>
        )}

        {activeTab === 'editor' && (
          <EditorPane
            editingName={editingId ? editingName : ''}
            name={editingName}
            setName={setEditingName}
            category={editingCategory}
            setCategory={setEditingCategory}
            status={editingStatus}
            setStatus={setEditingStatus}
            sender={editingSender}
            setSender={setEditingSender}
            entity={editingEntity}
            setEntity={setEditingEntity}
            subject={editingSubject}
            setSubject={setEditingSubject}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
            saving={saving}
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
    </div>
  )
}
