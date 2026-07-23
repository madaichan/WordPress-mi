import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import Card from '../../components/UI/Card.jsx'
import Table from '../../components/UI/Table.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'
import Textarea from '../../components/UI/Textarea.jsx'
import Label from '../../components/UI/Label.jsx'
import Checkbox from '../../components/UI/Checkbox.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { normalizePukatRole } from '../../utils/roles.js'

const ATTACK_TYPE_OPTIONS = ['BEC', 'Credential', 'Malware', 'Vishing']


const ASSET_CONFIG = {
  playbooks: {
    title: 'Master playbooks',
    subtitle: 'Publish reusable phishing simulation playbooks to selected users.',
    createLabel: 'New playbook',
    icon: 'ti-book',
    accent: 'violet',
    columns: ['Category', 'Difficulty'],
    statusOptions: ['Published', 'Draft'],
    items: [
      { id: 'pb-bec-invoice', name: 'BEC Invoice Approval', metaA: 'BEC', metaB: 'High', status: 'Published', assignedTo: 'all', users: [] },
      { id: 'pb-m365-reset', name: 'Microsoft 365 Password Reset', metaA: 'Credential', metaB: 'Medium', status: 'Published', assignedTo: 'specific', users: [2] },
      { id: 'pb-hr-policy', name: 'HR Policy Attachment', metaA: 'Malware', metaB: 'Low', status: 'Draft', assignedTo: 'specific', users: [1, 2] },
    ],
  },
  'sending-profiles': {
    title: 'Master sending profiles',
    subtitle: 'Control which SMTP profiles are available to operators.',
    createLabel: 'New sending profile',
    icon: 'ti-send',
    accent: 'blue',
    columns: ['Host', 'Encryption'],
    statusOptions: ['Valid', 'Not tested'],
    items: [
      { id: 'sp-finance-relay', name: 'finance-relay-01', metaA: 'smtp.relay-pool.internal:587', metaB: 'TLS', status: 'Valid', assignedTo: 'all', users: [] },
      { id: 'sp-hr-relay', name: 'hr-relay-03', metaA: 'smtp.hr-mailer.internal:587', metaB: 'TLS', status: 'Not tested', assignedTo: 'specific', users: [2] },
      { id: 'sp-public-pool', name: 'public-marketing-pool', metaA: 'mail.outbound.internal:465', metaB: 'SSL', status: 'Valid', assignedTo: 'specific', users: [1, 3] },
    ],
  },
  'email-templates': {
    title: 'Master email templates',
    subtitle: 'Manage approved GoPhish email templates and user availability.',
    createLabel: 'New email template',
    icon: 'ti-mail',
    accent: 'emerald',
    columns: ['Attack type', 'Sender'],
    statusOptions: ['Published', 'Draft'],
    items: [
      { id: 'et-invoice', name: 'Urgent invoice approval needed', metaA: 'BEC', metaB: 'CEO Corp', status: 'Published', assignedTo: 'all', users: [] },
      { id: 'et-m365-sync', name: 'Action required: Sync your inbox', metaA: 'Credential', metaB: 'Microsoft Security', status: 'Published', assignedTo: 'specific', users: [2, 3] },
      { id: 'et-benefits', name: 'HR welfare policy update', metaA: 'Malware', metaB: 'HR Benefits', status: 'Draft', assignedTo: 'specific', users: [1] },
    ],
  },
  'landing-pages': {
    title: 'Master landing pages',
    subtitle: 'Assign approved landing pages for simulations and training flows.',
    createLabel: 'New landing page',
    icon: 'ti-browser',
    accent: 'amber',
    columns: ['Capture mode', 'Theme'],
    statusOptions: ['Published', 'Draft'],
    items: [
      { id: 'lp-m365', name: 'Microsoft 365 Login Clone', metaA: 'Credentials', metaB: 'Microsoft', status: 'Published', assignedTo: 'all', users: [] },
      { id: 'lp-vendor-bank', name: 'Vendor Bank Update Portal', metaA: 'Form data', metaB: 'Finance', status: 'Published', assignedTo: 'specific', users: [1, 2] },
      { id: 'lp-prize', name: 'Prize Claim Portal', metaA: 'Credentials', metaB: 'Rewards', status: 'Draft', assignedTo: 'specific', users: [3] },
    ],
  },
}

const ACCENT_CLASS = {
  violet: 'bg-violet-100 text-violet-700',
  blue: 'bg-blue-100 text-blue-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
}

function normalizeUser(user) {
  return {
    id: Number(user.id),
    name: user.display_name || user.name || user.email || `User ${user.id}`,
    email: user.email || '',
    role: normalizePukatRole(user.pukat_role ?? user.role),
  }
}

function statusTone(status) {
  if (status === 'Published' || status === 'Valid') return 'success'
  if (status === 'Draft' || status === 'Not tested') return 'warning'
  return 'gray'
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeAssetId(type, name) {
  const prefix = {
    playbooks: 'pb',
    'sending-profiles': 'sp',
    'email-templates': 'et',
    'landing-pages': 'lp',
  }[type] ?? 'asset'

  return `${prefix}-${slugify(name) || 'asset'}-${Date.now().toString(36)}`
}

function defaultPort(encryption) {
  if (encryption === 'SSL') return '465'
  if (encryption === 'None') return '25'
  return '587'
}

function defaultCreateForm(type, config) {
  const base = {
    name: '',
    status: config.statusOptions[0],
    assignedTo: 'all',
    users: [],
  }

  if (type === 'playbooks') {
    return {
      ...base,
      description: '',
      category: 'Credential',
      difficulty: 'Medium',
      targetDepartment: 'All departments',
      emailTemplate: 'Action Required: Sync your corporate inbox',
      landingPage: 'Microsoft 365 Login Clone',
      sendingProfile: 'standard-relay-02',
      domain: 'mail.outlook-365-login.net',
      scenario: '',
    }
  }

  if (type === 'sending-profiles') {
    return {
      ...base,
      host: '',
      port: '587',
      encryption: 'TLS',
      username: '',
      password: '',
      from: '',
      ignoreCert: false,
    }
  }

  if (type === 'email-templates') {
    return {
      ...base,
      attackType: 'Credential',
      sender: 'Security Team <security@example.com>',
      subject: 'Action Required: Verify your account',
      body: '<p>Hi {{.FirstName}},</p>\n<p>Please verify your account to keep access active.</p>\n<p><a href="{{.URL}}">Verify account</a></p>',
    }
  }

  return {
    ...base,
    captureMode: 'Credentials',
    theme: 'Microsoft',
    redirectUrl: 'https://portal.office.com',
    captureData: true,
    capturePass: true,
    html: '<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Sign in</h1>\n    <form method="post">\n      <input name="email" placeholder="Email" />\n      <input name="password" type="password" placeholder="Password" />\n      <button type="submit">Continue</button>\n    </form>\n  </body>\n</html>',
  }
}

function buildAssetFromForm(type, form) {
  const common = {
    id: makeAssetId(type, form.name),
    name: form.name.trim(),
    status: form.status,
    assignedTo: form.assignedTo,
    users: form.assignedTo === 'all' ? [] : form.users,
  }

  if (type === 'playbooks') {
    return {
      ...common,
      metaA: form.category,
      metaB: form.difficulty,
      details: {
        description: form.description.trim(),
        targetDepartment: form.targetDepartment.trim(),
        emailTemplate: form.emailTemplate.trim(),
        landingPage: form.landingPage.trim(),
        sendingProfile: form.sendingProfile.trim(),
        domain: form.domain.trim(),
        scenario: form.scenario.trim(),
      },
    }
  }

  if (type === 'sending-profiles') {
    return {
      ...common,
      metaA: `${form.host.trim()}:${form.port.trim()}`,
      metaB: form.encryption,
      details: {
        host: form.host.trim(),
        port: form.port.trim(),
        encryption: form.encryption,
        username: form.username.trim(),
        from: form.from.trim(),
        ignoreCert: form.ignoreCert,
      },
    }
  }

  if (type === 'email-templates') {
    return {
      ...common,
      metaA: form.attackType,
      metaB: form.sender.trim(),
      details: {
        sender: form.sender.trim(),
        subject: form.subject.trim(),
        body: form.body.trim(),
      },
    }
  }

  return {
    ...common,
    metaA: form.captureMode,
    metaB: form.theme.trim(),
    details: {
      redirectUrl: form.redirectUrl.trim(),
      captureData: form.captureData,
      capturePass: form.capturePass,
      html: form.html.trim(),
    },
  }
}

function validateCreateForm(type, form) {
  if (!form.name.trim()) return 'Name is required.'

  if (type === 'playbooks') {
    if (!form.description.trim()) return 'Description is required.'
    if (!form.scenario.trim()) return 'Scenario narrative is required.'
  }

  if (type === 'sending-profiles') {
    if (!form.host.trim() || !form.port.trim() || !form.from.trim()) {
      return 'SMTP host, port, and From address are required.'
    }
  }

  if (type === 'email-templates') {
    if (!form.sender.trim() || !form.subject.trim() || !form.body.trim()) {
      return 'Sender, subject, and body are required.'
    }
  }

  if (type === 'landing-pages') {
    if (!form.theme.trim() || !form.redirectUrl.trim() || !form.html.trim()) {
      return 'Theme, redirect URL, and HTML source are required.'
    }
  }

  if (form.assignedTo === 'specific' && form.users.length === 0) {
    return 'Choose at least one user or assign to all users.'
  }

  return ''
}

function AssignmentSummary({ item, usersById }) {
  if (item.assignedTo === 'all') {
    return <Badge tone="violet">All users</Badge>
  }

  const selected = item.users.map(id => usersById.get(id)?.name).filter(Boolean)
  return (
    <div className="flex flex-wrap gap-1">
      {selected.slice(0, 2).map(name => (
        <Badge key={name} tone="gray">{name}</Badge>
      ))}
      {selected.length > 2 && <Badge tone="gray">+{selected.length - 2}</Badge>}
      {selected.length === 0 && <Badge tone="warning">No users</Badge>}
    </div>
  )
}

function CreateAssetPanel({ type, config, users, onClose, onCreate }) {
  const [form, setForm] = useState(() => defaultCreateForm(type, config))

  function update(field, value) {
    setForm(current => {
      if (type === 'sending-profiles' && field === 'encryption') {
        return { ...current, encryption: value, port: defaultPort(value) }
      }

      return { ...current, [field]: value }
    })
  }

  function toggleUser(userId) {
    setForm(current => ({
      ...current,
      users: current.users.includes(userId)
        ? current.users.filter(id => id !== userId)
        : [...current.users, userId],
    }))
  }

  function submit() {
    const error = validateCreateForm(type, form)
    if (error) {
      toast.error(error)
      return
    }

    onCreate(buildAssetFromForm(type, form))
  }

  function renderTemplateFields() {
    if (type === 'playbooks') {
      return (
        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Playbook scenario</div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={event => update('description', event.target.value)} className="min-h-[80px] resize-none" placeholder="Brief summary shown in the playbook library" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Attack type</Label>
              <Select value={form.category} onChange={event => update('category', event.target.value)}>
                {ATTACK_TYPE_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onChange={event => update('difficulty', event.target.value)}>
                {['Very Low', 'Low', 'Medium', 'High', 'Very High'].map(option => <option key={option}>{option}</option>)}
              </Select>
            </div>
            <div>
              <Label>Target department</Label>
              <Input value={form.targetDepartment} onChange={event => update('targetDepartment', event.target.value)} />
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Technical components</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Email template</Label>
              <Input value={form.emailTemplate} onChange={event => update('emailTemplate', event.target.value)} />
            </div>
            <div>
              <Label>Landing page</Label>
              <Input value={form.landingPage} onChange={event => update('landingPage', event.target.value)} />
            </div>
            <div>
              <Label>Sending profile</Label>
              <Input value={form.sendingProfile} onChange={event => update('sendingProfile', event.target.value)} />
            </div>
            <div>
              <Label>Dynamic domain</Label>
              <Input value={form.domain} onChange={event => update('domain', event.target.value)} />
            </div>
          </div>
          <div>
            <Label>Narrative shown to the target</Label>
            <Textarea value={form.scenario} onChange={event => update('scenario', event.target.value)} className="min-h-[110px] resize-none" placeholder="Describe the scenario used in this playbook" />
          </div>
        </section>
      )
    }

    if (type === 'sending-profiles') {
      return (
        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">SMTP configuration</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label>SMTP host</Label>
              <Input value={form.host} onChange={event => update('host', event.target.value)} placeholder="smtp.example.com" />
            </div>
            <div>
              <Label>Port</Label>
              <Input type="number" value={form.port} onChange={event => update('port', event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Encryption</Label>
              <Select value={form.encryption} onChange={event => update('encryption', event.target.value)}>
                <option>TLS</option>
                <option>SSL</option>
                <option>None</option>
              </Select>
            </div>
            <div>
              <Label>Username</Label>
              <Input value={form.username} onChange={event => update('username', event.target.value)} placeholder="smtp_user@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={event => update('password', event.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div>
            <Label>From address</Label>
            <Input value={form.from} onChange={event => update('from', event.target.value)} placeholder="Sender Name <sender@example.com>" />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
            <Checkbox checked={form.ignoreCert} onChange={event => update('ignoreCert', event.target.checked)} />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Ignore certificate errors</span>
              <span className="block text-xs text-gray-500">Useful for self-signed SMTP certificates in lab environments.</span>
            </span>
          </label>
        </section>
      )
    }

    if (type === 'email-templates') {
      return (
        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email template</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Attack type</Label>
              <Select value={form.attackType} onChange={event => update('attackType', event.target.value)}>
                {ATTACK_TYPE_OPTIONS.map(option => <option key={option}>{option}</option>)}
              </Select>
            </div>
            <div>
              <Label>Sender</Label>
              <Input value={form.sender} onChange={event => update('sender', event.target.value)} placeholder="Security Team <security@example.com>" />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={form.subject} onChange={event => update('subject', event.target.value)} placeholder="Action Required: Verify your account" />
          </div>
          <div>
            <Label>HTML body</Label>
            <Textarea value={form.body} onChange={event => update('body', event.target.value)} className="min-h-[220px] resize-y font-mono text-xs" />
          </div>
          <p className="text-xs text-gray-500">Supported GoPhish variables include <code className="rounded bg-gray-100 px-1 py-0.5">{'{{.FirstName}}'}</code>, <code className="rounded bg-gray-100 px-1 py-0.5">{'{{.Email}}'}</code>, and <code className="rounded bg-gray-100 px-1 py-0.5">{'{{.URL}}'}</code>.</p>
        </section>
      )
    }

    return (
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Landing page template</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Capture mode</Label>
            <Select value={form.captureMode} onChange={event => update('captureMode', event.target.value)}>
              <option>Credentials</option>
              <option>Form data</option>
              <option>Redirect only</option>
            </Select>
          </div>
          <div>
            <Label>Theme</Label>
            <Input value={form.theme} onChange={event => update('theme', event.target.value)} placeholder="Microsoft" />
          </div>
        </div>
        <div>
          <Label>Redirect URL after submit</Label>
          <Input value={form.redirectUrl} onChange={event => update('redirectUrl', event.target.value)} placeholder="https://portal.office.com" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
            <Checkbox checked={form.captureData} onChange={event => update('captureData', event.target.checked)} />
            <span className="text-sm font-semibold text-gray-900">Capture submitted data</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
            <Checkbox checked={form.capturePass} onChange={event => update('capturePass', event.target.checked)} />
            <span className="text-sm font-semibold text-gray-900">Capture passwords</span>
          </label>
        </div>
        <div>
          <Label>HTML source</Label>
          <Textarea value={form.html} onChange={event => update('html', event.target.value)} className="min-h-[260px] resize-y font-mono text-xs" />
        </div>
      </section>
    )
  }

  return (
    <Drawer
      onClose={onClose}
      widthClass="max-w-lg"
      title={config.createLabel}
      subtitle="Create a master asset and choose who can use it."
      icon={
        <div className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', ACCENT_CLASS[config.accent])}>
          <i className={clsx('ti text-base', config.icon)} />
        </div>
      }
      footer={
        <>
          <Button variant="secondary" className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            <i className="ti ti-plus" />
            Create asset
          </Button>
        </>
      }
    >
      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Asset details</div>
        <div>
          <Label>Name</Label>
          <Input value={form.name} onChange={event => update('name', event.target.value)} placeholder={`Example: ${config.items[0]?.name ?? 'New asset'}`} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onChange={event => update('status', event.target.value)}>
            {config.statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </Select>
        </div>
      </section>

      {renderTemplateFields()}

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Assignment</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => update('assignedTo', 'all')}
            className={clsx('rounded-xl border p-3 text-left transition-all', form.assignedTo === 'all' ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}
          >
            <span className="block text-sm font-semibold text-gray-900">All users</span>
            <span className="mt-0.5 block text-xs text-gray-500">Available to everyone.</span>
          </button>
          <button
            type="button"
            onClick={() => update('assignedTo', 'specific')}
            className={clsx('rounded-xl border p-3 text-left transition-all', form.assignedTo === 'specific' ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}
          >
            <span className="block text-sm font-semibold text-gray-900">Specific users</span>
            <span className="mt-0.5 block text-xs text-gray-500">Limit visibility.</span>
          </button>
        </div>

        {form.assignedTo === 'specific' && (
          <div className="space-y-2">
            {users.map(user => (
              <label key={user.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 p-3 hover:bg-gray-50">
                <Checkbox checked={form.users.includes(user.id)} onChange={() => toggleUser(user.id)} />
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{user.name}</span>
                  <span className="block truncate text-xs text-gray-500">{user.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>
    </Drawer>
  )
}

export default function MasterAssetPage({ type }) {
  const config = ASSET_CONFIG[type] ?? ASSET_CONFIG.playbooks
  const [items, setItems] = useState(config.items)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)

  const { data: usersData } = useUsers({ per_page: 100 })

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(normalizeUser)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items

    return items.filter(item => (
      item.name.toLowerCase().includes(term)
      || item.metaA.toLowerCase().includes(term)
      || item.metaB.toLowerCase().includes(term)
      || item.status.toLowerCase().includes(term)
    ))
  }, [items, query])

  const allAssigned = items.filter(item => item.assignedTo === 'all').length
  const specificAssigned = items.length - allAssigned

  function saveAssignment(nextAssignment) {
    setItems(current => current.map(item => (
      item.id === editing.id ? { ...item, ...nextAssignment } : item
    )))
    toast.success('Assignment updated.')
    setEditing(null)
  }

  function createAsset(asset) {
    setItems(current => [asset, ...current])
    setQuery('')
    toast.success(`Asset "${asset.name}" created.`)
    setCreating(false)
  }

  return (
    <div className="space-y-5 animate-fade-in mt-4">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <i className="ti ti-plus" />
            {config.createLabel}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <div className={clsx('flex h-11 w-11 items-center justify-center rounded-xl text-lg', ACCENT_CLASS[config.accent])}>
            <i className={clsx('ti', config.icon)} />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{items.length}</div>
            <div className="text-xs font-semibold text-gray-500">Master assets</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{allAssigned}</div>
          <div className="text-xs font-semibold text-gray-500">Available to all users</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-900">{specificAssigned}</div>
          <div className="text-xs font-semibold text-gray-500">Assigned to specific users</div>
        </Card>
      </div>

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Library</h2>
            <p className="mt-0.5 text-xs text-gray-500">Manage visibility before users create campaigns.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <i className="ti ti-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search assets..."
              className="pl-9"
              type="search"
            />
          </div>
        </div>

        <Table wrapperClassName="rounded-none border-0">
          <thead>
            <tr>
              <th>Asset</th>
              <th>{config.columns[0]}</th>
              <th>{config.columns[1]}</th>
              <th>Status</th>
              <th>Assignment</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', ACCENT_CLASS[config.accent])}>
                      <i className={clsx('ti text-sm', config.icon)} />
                    </span>
                    <div>
                      <div className="font-semibold text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400">{item.id}</div>
                    </div>
                  </div>
                </td>
                <td>{item.metaA}</td>
                <td>{item.metaB}</td>
                <td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                <td><AssignmentSummary item={item} usersById={usersById} /></td>
                <td className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(item)}>
                    <i className="ti ti-user-check" />
                    Assign
                  </Button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">No assets found.</td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {editing && (
        <AssignmentPanel
          item={editing}
          users={users}
          onClose={() => setEditing(null)}
          onSave={saveAssignment}
        />
      )}
      {creating && (
        <CreateAssetPanel
          type={type}
          config={config}
          users={users}
          onClose={() => setCreating(false)}
          onCreate={createAsset}
        />
      )}
    </div>
  )
}
