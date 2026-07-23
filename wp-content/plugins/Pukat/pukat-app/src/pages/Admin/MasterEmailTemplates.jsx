import { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import HtmlCodeEditor from '../../components/Editor/HtmlCodeEditor.jsx'
import ClientPreview from '../../components/Editor/ClientPreview.jsx'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import TableActionButton from '../../components/UI/TableActionButton.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import Badge from '../../components/UI/Badge.jsx'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { normalizePukatRole } from '../../utils/roles.js'


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

const INITIAL_TEMPLATES = [
  {
    id: 'ms',
    name: 'Microsoft Office 365 Alert',
    category: 'alert',
    status: 'Published',
    description: 'Security login email style with an urgent password update request.',
    sender: 'Microsoft Security <security@microsoft-update.net>',
    subject: 'Action Required: Unauthorized login attempt detected',
    assignedTo: 'all',
    users: [],
    thumbnail: { icon: 'ti-mail-opened', bg: 'bg-red-500/20 text-red-500' },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; }
    .blue-btn { background-color: #0067b8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="font-size: 14px; font-weight: 600; color: #5e5e5e;">Microsoft Account Security</div>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
    <h3 style="font-size: 16px; font-weight: 600; color: #111;">Security alert</h3>
    <p>Dear {{.FirstName}},</p>
    <p>We detected unusual sign-in activity on your Microsoft 365 Account ({{.Email}}) from an unrecognized device or IP address.</p>
    <div style="background: #f9f9f9; border-radius: 6px; padding: 12px; margin: 15px 0; font-size: 12px;">
      <div><strong>Country/Region:</strong> Netherlands</div>
      <div><strong>IP Address:</strong> 185.220.101.4</div>
      <div><strong>Browser:</strong> Chrome / Windows 10</div>
    </div>
    <p>Please click the button below to verify your login credentials and prevent account lockout.</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="{{.URL}}" class="blue-btn">Verify account</a>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'google',
    name: 'Google Security Notification',
    category: 'alert',
    status: 'Published',
    description: 'Warns about an unknown login from a new device.',
    sender: 'Google Security <support@google-help.com>',
    subject: 'Security alert: Critical sign-in blocked',
    assignedTo: 'specific',
    users: [2],
    thumbnail: { icon: 'ti-shield', bg: 'bg-blue-500/20 text-blue-500' },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Roboto, sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-top: 4px solid #ea4335; }
    .btn { background-color: #1a73e8; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
      <span style="color:#4285f4">G</span><span style="color:#ea4335">o</span><span style="color:#fbbc05">o</span><span style="color:#4285f4">g</span><span style="color:#34a853">l</span><span style="color:#ea4335">e</span>
    </div>
    <h3 style="font-size: 16px; font-weight: bold; color: #111; margin-top: 0;">Security alert: Critical Sign-in Blocked</h3>
    <p>Hello {{.FirstName}},</p>
    <p>Google blocked a critical login attempt to your Google Workspace Account ({{.Email}}).</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check activity</a>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'hr',
    name: 'Internal HR Payroll Info',
    category: 'info',
    status: 'Draft',
    description: 'Quarterly payroll notification with a linked document.',
    sender: 'HR Department <payroll@internal-company.id>',
    subject: 'HR Info: Q3 Payroll Statement Update',
    assignedTo: 'specific',
    users: [1, 3],
    thumbnail: { icon: 'ti-receipt', bg: 'bg-emerald-500/20 text-emerald-500' },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #444; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .btn { background-color: #8b5cf6; color: white !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <strong>Human Resources Department</strong>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Dear Employee {{.FirstName}},</p>
    <p>Please review the payroll details and adjustment slip for the upcoming Q3 corporate tax calculation.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">Check payroll statement</a>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'djp',
    name: 'DJP Online Tax Warning',
    category: 'urgent',
    status: 'Published',
    description: 'Urgent tax e-billing notification requiring immediate action.',
    sender: 'DJP Online <e-filing@pajak.go.id>',
    subject: 'Notification: 2024 Tax Arrears Warning',
    assignedTo: 'all',
    users: [],
    thumbnail: { icon: 'ti-alert-triangle', bg: 'bg-yellow-500/20 text-yellow-500' },
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
    .btn { background-color: #eab308; color: #0b172a !important; padding: 10px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <strong>DIREKTORAT JENDERAL PAJAK</strong>
    <hr style="border:0; border-top: 1px solid #eee; margin: 15px 0;">
    <p>Dear {{.FirstName}},</p>
    <p>This electronic notice is issued because an annual tax arrears verification is pending.</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="{{.URL}}" class="btn">PAY E-BILLING</a>
    </div>
  </div>
</body>
</html>`,
  },
]

function normalizeUser(user) {
  return {
    id: Number(user.id),
    name: user.display_name || user.name || user.email || `User ${user.id}`,
    email: user.email || '',
    role: normalizePukatRole(user.pukat_role ?? user.role),
  }
}

function StatusBadge({ status }) {
  const published = status === 'Published'
  return <Badge tone={published ? 'success' : 'warning'} className="text-[10px]">{status}</Badge>
}

function EmailTemplatesTable({ templates, usersById, onEdit, onPreview, onAssign }) {
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
              <th className="w-32 p-4 pr-6 text-right">Actions</th>
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
                      <div className="mt-0.5 max-w-xs truncate text-[11px] text-gray-500">{template.description || template.id}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <Badge tone="gray" className="text-[10px] capitalize">
                    {template.category.replace('-', ' ')}
                  </Badge>
                </td>
                <td className="p-4">
                  <span className="block max-w-[180px] truncate text-[11px] font-medium text-gray-700">{template.sender}</span>
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
                <td className="w-32 p-4 pr-6 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <TableActionButton icon="ti-edit" label={`Edit ${template.name}`} title="Edit" onClick={() => onEdit(template.id)} />
                    <TableActionButton icon="ti-eye" label={`Preview ${template.name}`} title="Preview" tone="blue" onClick={() => onPreview(template.id)} />
                    <TableActionButton icon="ti-user-check" label={`Assign ${template.name}`} title="Assign" onClick={() => onAssign(template.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-gray-400">
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
  subject,
  setSubject,
  htmlCode,
  setHtmlCode,
  onBack,
  onSave,
}) {
  const title = editingName ? `Edit template: ${editingName}` : 'Create email template'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">Configure the envelope header and phishing email HTML source.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button variant="primary" onClick={onSave}>Save template</Button>
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
              <span className="block font-semibold text-gray-700">Sender *</span>
              <input value={sender} onChange={event => setSender(event.target.value)} placeholder="Example: Admin <admin@company.id>" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-950 outline-none focus:border-violet-500" />
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
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES)
  const [activeTab, setActiveTab] = useState('list')
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [assignmentId, setAssignmentId] = useState(null)
  const [previewTitle, setPreviewTitle] = useState('Microsoft Office 365 Alert')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingCategory, setEditingCategory] = useState('alert')
  const [editingStatus, setEditingStatus] = useState('Published')
  const [editingSender, setEditingSender] = useState('')
  const [editingSubject, setEditingSubject] = useState('')
  const [editingHtml, setEditingHtml] = useState('')
  const [syncing, setSyncing] = useState(false)

  const { data: usersData } = useUsers({ per_page: 100 })

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(normalizeUser)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])
  const assignmentTemplate = templates.find(template => template.id === assignmentId)

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
      || template.subject.toLowerCase().includes(query)
    ))
  }, [activeFilter, searchQuery, templates])

  const categories = useMemo(() => ([
    { key: 'all', label: 'All', count: templates.length },
    { key: 'alert', label: 'Security alert', count: templates.filter(template => template.category === 'alert').length },
    { key: 'info', label: 'Internal info', count: templates.filter(template => template.category === 'info').length },
    { key: 'urgent', label: 'Urgent notification', count: templates.filter(template => template.category === 'urgent').length },
  ]), [templates])
  const availableToAllCount = templates.filter(template => template.assignedTo === 'all').length
  const assignedToSpecificCount = templates.length - availableToAllCount

  const clearEditingState = useCallback(() => {
    setEditingId(null)
    setEditingName('')
    setEditingCategory('alert')
    setEditingStatus('Published')
    setEditingSender('')
    setEditingSubject('')
    setEditingHtml('')
  }, [])

  const switchTab = useCallback((tab) => {
    setActiveTab(tab)
    if (tab === 'list') clearEditingState()
  }, [clearEditingState])

  const loadTemplateForWork = useCallback((id) => {
    const template = templates.find(item => item.id === id)
    if (!template) return null

    setEditingId(template.id)
    setEditingName(template.name)
    setEditingCategory(template.category || 'alert')
    setEditingStatus(template.status || 'Published')
    setEditingSender(template.sender || '')
    setEditingSubject(template.subject || '')
    setEditingHtml(template.html || '')
    return template
  }, [templates])

  const handleEdit = useCallback((id) => {
    if (loadTemplateForWork(id)) setActiveTab('editor')
  }, [loadTemplateForWork])

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
    setEditingSubject('Action Required: Important Notification')
    setEditingHtml(DEFAULT_HTML)
    setActiveTab('editor')
  }, [])

  const handleSave = useCallback(() => {
    if (!editingName.trim() || !editingSender.trim() || !editingSubject.trim() || !editingHtml.trim()) {
      toast.error('Template name, sender, subject, and HTML source are required.')
      return
    }

    if (editingId) {
      setTemplates(current => current.map(template => (
        template.id === editingId
          ? {
            ...template,
            name: editingName.trim(),
            category: editingCategory,
            status: editingStatus,
            sender: editingSender.trim(),
            subject: editingSubject.trim(),
            html: editingHtml,
          }
          : template
      )))
      toast.success(`Template "${editingName.trim()}" saved.`)
    } else {
      const newTemplate = {
        id: `custom_${Date.now()}`,
        name: editingName.trim(),
        category: editingCategory,
        status: editingStatus,
        description: 'Custom email template created from the master library.',
        sender: editingSender.trim(),
        subject: editingSubject.trim(),
        html: editingHtml,
        assignedTo: 'all',
        users: [],
        thumbnail: { icon: 'ti-mail', bg: 'bg-violet-500/20 text-violet-500' },
      }
      setTemplates(current => [newTemplate, ...current])
      toast.success(`Template "${newTemplate.name}" created.`)
    }

    setSearchQuery('')
    switchTab('list')
  }, [editingCategory, editingHtml, editingId, editingName, editingSender, editingStatus, editingSubject, switchTab])

  const handleSync = useCallback(() => {
    setSyncing(true)
    toast('Syncing email templates from GoPhish...', { icon: 'sync' })
    window.setTimeout(() => {
      setSyncing(false)
      toast.success(`Sync complete - ${templates.length} email templates`)
    }, 1200)
  }, [templates.length])

  function saveAssignment(nextAssignment) {
    setTemplates(current => current.map(template => (
      template.id === assignmentId ? { ...template, ...nextAssignment } : template
    )))
    toast.success('Assignment updated.')
    setAssignmentId(null)
  }

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
        subtitle="Manage approved GoPhish email templates and user availability."
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
            <Button variant="outline" onClick={handleSync} disabled={syncing}>
              <i className={clsx('ti ti-refresh text-base', syncing && 'animate-spin')} />
              <span>Sync GoPhish</span>
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
          <div className="text-2xl font-bold text-gray-900">{availableToAllCount}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">Available to all users</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{assignedToSpecificCount}</div>
          <div className="mt-1 text-xs font-semibold text-gray-500">Assigned to specific users</div>
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
              onAssign={setAssignmentId}
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
            subject={editingSubject}
            setSubject={setEditingSubject}
            htmlCode={editingHtml}
            setHtmlCode={setEditingHtml}
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
          item={assignmentTemplate}
          resourceLabel="email template"
          users={users}
          onClose={() => setAssignmentId(null)}
          onSave={saveAssignment}
        />
      )}
    </div>
  )
}
