import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
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
import TableActionButton from '../../components/UI/TableActionButton.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import {
  PlaybookComponentSelect,
  PlaybookField,
  PlaybookPreviewModal,
  playbookFieldClass,
} from '../../components/playbooks/PlaybookFormControls.jsx'
import {
  useMasterDynamicDomains,
  useMasterEmailTemplates,
  useMasterLandingPages,
  useMasterSendingProfiles,
} from '../../hooks/queries/useMasterAssetQueries.js'
import { useGophishSmtpProfiles } from '../../hooks/queries/useGophishQueries.js'
import { usePlaybooks } from '../../hooks/queries/usePlaybookQueries.js'
import {
  useApprovePlaybookMutation,
  useCreatePlaybookMutation,
  useDeletePlaybookMutation,
  useDuplicatePlaybookMutation,
  useSubmitPlaybookReviewMutation,
  useUpdatePlaybookMutation,
} from '../../hooks/mutations/usePlaybookMutations.js'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { masterAssetApi } from '../../api/index.js'
import useAppStore from '../../store/useAppStore.js'
import {
  EMPTY_PLAYBOOK_COMPONENT_OPTIONS,
  firstOption,
  optionLabel,
  playbookComponentOptions,
} from '../../utils/playbookComponentOptions.js'
import { GENERAL_ENTITY, applyAssignmentFromEntity, entityFromAssignment } from '../../utils/entityAssignmentHelpers.js'
import { playbookDisplayStatus } from '../../utils/masterAssetHelpers.js'
import { normalizePukatRole } from '../../utils/roles.js'

const ATTACK_TYPE_OPTIONS = ['BEC', 'Credential', 'Malware', 'Vishing']

const DIFFICULTY_OPTIONS = [
  { value: 'Very Low', score: 1, label: 'Very Low (1/5)' },
  { value: 'Low', score: 2, label: 'Low (2/5)' },
  { value: 'Medium', score: 3, label: 'Medium (3/5)' },
  { value: 'High', score: 4, label: 'High (4/5)' },
  { value: 'Very High', score: 5, label: 'Very High (5/5)' },
]

const PLAYBOOK_COMPONENT_FIELDS = [
  {
    field: 'emailTemplate',
    optionKey: 'email',
    previewType: 'email',
    icon: 'ti-mail',
    bg: '#DBEAFE',
    color: '#1D4ED8',
    label: 'Email template',
  },
  {
    field: 'landingPage',
    optionKey: 'page',
    previewType: 'landing',
    icon: 'ti-world',
    bg: '#D1FAE5',
    color: '#065F46',
    label: 'Landing page',
  },
  {
    field: 'sendingProfile',
    optionKey: 'smtp',
    icon: 'ti-send',
    bg: '#FEF3C7',
    color: '#92400E',
    label: 'Sending profile',
  },
  {
    field: 'domain',
    optionKey: 'domain',
    icon: 'ti-network',
    bg: '#F3E8FF',
    color: '#7C3AED',
    label: 'Dynamic domain',
  },
]


const ASSET_CONFIG = {
  playbooks: {
    title: 'Master playbooks',
    subtitle: 'Publish reusable phishing simulation playbooks to selected users.',
    createLabel: 'New playbook',
    icon: 'ti-book',
    accent: 'violet',
    columns: ['Category', 'Difficulty'],
    statusOptions: ['Draft', 'Published'],
    items: [],
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
    entity: user.entity || user.pukat_entity || '',
  }
}

function statusTone(status) {
  if (status === 'Published' || status === 'Valid') return 'success'
  if (status === 'Draft' || status === 'Not tested') return 'warning'
  return 'gray'
}

function playbookStatusFromDisplay(status) {
  return status === 'Published' ? 'active' : 'draft'
}

function playbookDifficultyLabel(value) {
  return difficultyLabelFromValue(difficultyValueFromScore(value)).replace(/ \(\d\/5\)$/, '')
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

function defaultCreateForm(type, config, componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS) {
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
      emailTemplate: firstOption(componentOptions, 'email'),
      landingPage: firstOption(componentOptions, 'page'),
      sendingProfile: firstOption(componentOptions, 'smtp'),
      domain: firstOption(componentOptions, 'domain'),
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

function playbookItemFromRow(row, users) {
  const activeCampaignRunCount = Number(row.usage?.active_campaign_run_count || row.active_campaign_run_count || 0)
  const item = {
    id: String(row.id),
    raw: row,
    name: row.name || `Playbook ${row.id}`,
    metaA: row.scenario || 'Credential',
    metaB: playbookDifficultyLabel(row.difficulty || 3),
    status: playbookDisplayStatus(row.status),
    rawStatus: row.status,
    entity: row.entity || GENERAL_ENTITY,
    assignedTo: 'all',
    users: [],
    editLocked: Boolean(row.edit_locked) || activeCampaignRunCount > 0,
    activeCampaignRunCount,
    editLockReason: row.edit_lock_reason || 'This playbook is used by an active campaign.',
  }

  return applyAssignmentFromEntity(item, users)
}

function buildPlaybookPayloadFromForm(form, entity) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    objective: form.scenario.trim(),
    scenario: form.category,
    difficulty: difficultyScoreFromValue(form.difficulty),
    default_email_template_version_id: Number(form.emailTemplate) || null,
    default_landing_page_version_id: Number(form.landingPage) || null,
    default_sending_profile_ref_id: Number(form.sendingProfile) || null,
    default_dynamic_domain_id: Number(form.domain) || null,
    entity: entity || GENERAL_ENTITY,
    status: playbookStatusFromDisplay(form.status),
  }
}

function buildPlaybookPayloadFromRow(row, overrides = {}) {
  return {
    name: row.name || '',
    description: row.description || '',
    objective: row.objective || '',
    scenario: row.scenario || '',
    difficulty: Number(row.difficulty || 1) || 1,
    default_email_template_version_id: Number(row.default_email_template_version_id || 0) || null,
    default_landing_page_version_id: Number(row.default_landing_page_version_id || 0) || null,
    default_sending_profile_ref_id: Number(row.default_sending_profile_ref_id || 0) || null,
    default_dynamic_domain_id: Number(row.default_dynamic_domain_id || 0) || null,
    entity: row.entity || GENERAL_ENTITY,
    status: row.status || 'draft',
    version: Number(row.version || 1) || 1,
    ...overrides,
  }
}

function playbookFormFromItem(item) {
  const row = item?.raw || {}

  return {
    name: row.name || item?.name || '',
    status: playbookDisplayStatus(row.status || item?.status),
    assignedTo: item?.assignedTo || 'all',
    users: item?.users || [],
    description: row.description || '',
    category: row.scenario || item?.metaA || 'Credential',
    difficulty: difficultyValueFromScore(row.difficulty || 3),
    targetDepartment: 'All departments',
    emailTemplate: String(row.default_email_template_version_id || ''),
    landingPage: String(row.default_landing_page_version_id || ''),
    sendingProfile: String(row.default_sending_profile_ref_id || ''),
    domain: String(row.default_dynamic_domain_id || ''),
    scenario: row.objective || '',
  }
}

function difficultyScoreFromValue(value) {
  return DIFFICULTY_OPTIONS.find(option => option.value === value)?.score ?? 3
}

function difficultyValueFromScore(score) {
  return DIFFICULTY_OPTIONS.find(option => option.score === Number(score))?.value ?? 'Medium'
}

function difficultyLabelFromValue(value) {
  return DIFFICULTY_OPTIONS.find(option => option.value === value)?.label ?? 'Medium (3/5)'
}

function PlaybookAssignmentEditor({ form, users, onChange, onToggleUser }) {
  return (
    <section className="space-y-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Assignment</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChange('assignedTo', 'all')}
          className={clsx('rounded-lg border p-3 text-left transition-all', form.assignedTo === 'all' ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}
        >
          <span className="block text-sm font-semibold text-gray-900">All users</span>
          <span className="mt-0.5 block text-xs text-gray-500">Available to everyone.</span>
        </button>
        <button
          type="button"
          onClick={() => onChange('assignedTo', 'specific')}
          className={clsx('rounded-lg border p-3 text-left transition-all', form.assignedTo === 'specific' ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:bg-gray-50')}
        >
          <span className="block text-sm font-semibold text-gray-900">Specific users</span>
          <span className="mt-0.5 block text-xs text-gray-500">Limit visibility.</span>
        </button>
      </div>

      {form.assignedTo === 'specific' && (
        <div className="space-y-2">
          {users.map(user => (
            <div
              key={user.id}
              role="button"
              tabIndex={0}
              onClick={() => onToggleUser(user.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onToggleUser(user.id)
                }
              }}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
            >
              <Checkbox
                checked={form.users.includes(user.id)}
                onClick={event => event.stopPropagation()}
                onChange={() => onToggleUser(user.id)}
              />
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">{user.name}</span>
                <span className="block truncate text-xs text-gray-500">{user.email}</span>
              </span>
            </div>
          ))}
          {users.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs font-medium text-gray-400">
              No users available.
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function CreateAssetPanel({
  type,
  config,
  users,
  componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS,
  mode = 'create',
  initialForm = null,
  saving = false,
  onClose,
  onCreate,
}) {
  const [form, setForm] = useState(() => initialForm ?? defaultCreateForm(type, config, componentOptions))
  const [preview, setPreview] = useState(null)
  const isEdit = mode === 'edit'

  useEffect(() => {
    if (type !== 'playbooks') return
    if (isEdit) return

    setForm(current => {
      const next = {
        ...current,
        emailTemplate: current.emailTemplate || firstOption(componentOptions, 'email'),
        landingPage: current.landingPage || firstOption(componentOptions, 'page'),
        sendingProfile: current.sendingProfile || firstOption(componentOptions, 'smtp'),
        domain: current.domain || firstOption(componentOptions, 'domain'),
      }

      if (
        next.emailTemplate === current.emailTemplate
        && next.landingPage === current.landingPage
        && next.sendingProfile === current.sendingProfile
        && next.domain === current.domain
      ) {
        return current
      }

      return next
    })
  }, [componentOptions, isEdit, type])

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

    onCreate(type === 'playbooks' ? form : buildAssetFromForm(type, form))
  }

  function renderPlaybookDrawer() {
    const difficultyScore = difficultyScoreFromValue(form.difficulty)

    function previewComponent(component, option) {
      if (option?.preview) {
        setPreview(option.preview)
        return
      }

      const value = option?.label || optionLabel(componentOptions[component.optionKey] || [], form[component.field], form[component.field])
      if (!value) return
      setPreview({ type: component.previewType, value })
    }

    return (
      <div
        className="fixed inset-0 z-50 flex justify-end bg-navy/40 backdrop-blur-sm"
        onMouseDown={event => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <aside className="flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl animate-slide-in">
          <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 px-6 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <i className={clsx('ti', isEdit ? 'ti-edit' : 'ti-plus')} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-gray-900">{isEdit ? 'Edit playbook' : 'Create playbook'}</h2>
              <p className="text-xs text-gray-500">{isEdit ? 'Update the master playbook and assignment.' : 'Create a master playbook and choose who can use it.'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close playbook form"
            >
              <i className="ti ti-x text-lg" />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            <section className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Basic information</div>
              <PlaybookField label="Playbook name" required>
                <input
                  value={form.name}
                  onChange={event => update('name', event.target.value)}
                  placeholder="Example: BEC - finance approval"
                  className={playbookFieldClass()}
                />
              </PlaybookField>
              <PlaybookField label="Description" required>
                <textarea
                  value={form.description}
                  onChange={event => update('description', event.target.value)}
                  placeholder="Brief playbook summary"
                  rows={3}
                  className={clsx(playbookFieldClass(), 'resize-none')}
                />
              </PlaybookField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <PlaybookField label="Attack type">
                  <select value={form.category} onChange={event => update('category', event.target.value)} className={playbookFieldClass()}>
                    {ATTACK_TYPE_OPTIONS.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </PlaybookField>
                <PlaybookField label="Status">
                  <select value={form.status} onChange={event => update('status', event.target.value)} className={playbookFieldClass()}>
                    {config.statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </PlaybookField>
              </div>
              <PlaybookField label="Target department">
                <input
                  value={form.targetDepartment}
                  onChange={event => update('targetDepartment', event.target.value)}
                  placeholder="All departments"
                  className={playbookFieldClass()}
                />
              </PlaybookField>
              <PlaybookField label="Difficulty">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={difficultyScore}
                  onChange={event => update('difficulty', difficultyValueFromScore(event.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(score => (
                      <span
                        key={score}
                        className={clsx('h-1.5 w-8 rounded-full', score <= difficultyScore ? 'bg-red-500' : 'bg-gray-200')}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-red-700">
                    {difficultyLabelFromValue(form.difficulty)}
                  </span>
                </div>
              </PlaybookField>
            </section>

            <div className="h-px bg-gray-100" />

            <section className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Technical components</div>
              {PLAYBOOK_COMPONENT_FIELDS.map(component => (
                <PlaybookComponentSelect
                  key={component.field}
                  icon={component.icon}
                  bg={component.bg}
                  color={component.color}
                  label={component.label}
                  value={form[component.field]}
                  options={componentOptions[component.optionKey] || []}
                  emptyLabel={component.optionKey === 'domain' ? 'No dynamic domain (optional)' : ''}
                  onChange={value => update(component.field, value)}
                  onPreview={component.previewType ? option => previewComponent(component, option) : undefined}
                />
              ))}
            </section>

            <div className="h-px bg-gray-100" />

            <section className="space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Scenario</div>
              <PlaybookField label="Narrative shown to the target" required hint="This text appears in the playbook details after saving.">
                <textarea
                  value={form.scenario}
                  onChange={event => update('scenario', event.target.value)}
                  rows={5}
                  placeholder="The target receives an email..."
                  className={clsx(playbookFieldClass(), 'resize-none')}
                />
              </PlaybookField>
            </section>

            <div className="h-px bg-gray-100" />

            <PlaybookAssignmentEditor
              form={form}
              users={users}
              onChange={update}
              onToggleUser={toggleUser}
            />
          </div>

          <footer className="flex flex-shrink-0 items-center gap-3 border-t border-gray-200 bg-gray-50 px-6 py-5">
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500 bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-600"
            >
              <i className="ti ti-device-floppy" />
              {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create playbook'}
            </button>
          </footer>
        </aside>
        <PlaybookPreviewModal
          preview={preview}
          onClose={() => setPreview(null)}
          offsetForSlideover
        />
      </div>
    )
  }

  function renderTemplateFields() {
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

  if (type === 'playbooks') {
    return renderPlaybookDrawer()
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
          <Button variant="primary" onClick={submit} disabled={saving}>
            <i className="ti ti-plus" />
            {saving ? 'Saving...' : 'Create asset'}
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
  const [items, setItems] = useState(() => (type === 'playbooks' ? [] : config.items))
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [editingPlaybook, setEditingPlaybook] = useState(null)
  const [deletingPlaybook, setDeletingPlaybook] = useState(null)
  const [approvingPlaybook, setApprovingPlaybook] = useState(null)
  const [creating, setCreating] = useState(false)
  const [savingPlaybook, setSavingPlaybook] = useState(false)
  const currentUser = useAppStore(state => state.user)
  const canSubmitReviewCapability = useAppStore(state => state.hasPermission('master_playbooks.edit'))
  const canApproveCapability = useAppStore(state => state.hasPermission('master_playbooks.approve'))

  const { data: usersData } = useUsers({ per_page: 100 })
  const componentQueryOptions = { enabled: type === 'playbooks' }
  const { data: emailTemplates = [] } = useMasterEmailTemplates(componentQueryOptions)
  const { data: landingPages = [] } = useMasterLandingPages(componentQueryOptions)
  const { data: sendingProfiles = [], refetch: refetchSendingProfiles } = useMasterSendingProfiles(componentQueryOptions)
  const { data: dynamicDomains = [] } = useMasterDynamicDomains(componentQueryOptions)
  const { data: gophishSmtpProfiles = [] } = useGophishSmtpProfiles(componentQueryOptions)
  const { data: playbookRows = [], isLoading: playbooksLoading } = usePlaybooks({
    enabled: type === 'playbooks',
    placeholderData: previous => previous,
  })

  const createPlaybookMutation = useCreatePlaybookMutation({
    onSuccess: () => {
      setQuery('')
      setCreating(false)
    },
  })
  const updatePlaybookMutation = useUpdatePlaybookMutation({
    onSuccess: () => {
      setEditing(null)
      setEditingPlaybook(null)
    },
  })
  const duplicatePlaybookMutation = useDuplicatePlaybookMutation()
  const deletePlaybookMutation = useDeletePlaybookMutation({
    onSuccess: () => {
      setEditing(null)
      setEditingPlaybook(null)
      setDeletingPlaybook(null)
    },
  })
  const submitReviewMutation = useSubmitPlaybookReviewMutation()
  const approveMutation = useApprovePlaybookMutation({
    onSuccess: () => setApprovingPlaybook(null),
  })

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(normalizeUser)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const componentOptions = useMemo(() => (
    playbookComponentOptions({
      emailTemplates,
      landingPages,
      sendingProfiles,
      dynamicDomains,
      gophishSmtpProfiles,
    })
  ), [dynamicDomains, emailTemplates, gophishSmtpProfiles, landingPages, sendingProfiles])

  const playbookItems = useMemo(() => (
    Array.isArray(playbookRows)
      ? playbookRows
        .filter(row => row?.status !== 'archived')
        .map(row => playbookItemFromRow(row, users))
      : []
  ), [playbookRows, users])

  useEffect(() => {
    if (type === 'playbooks') {
      setItems(playbookItems)
      return
    }

    setItems(config.items)
  }, [config.items, playbookItems, type])

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
  const playbookFormSaving = savingPlaybook || createPlaybookMutation.isPending || updatePlaybookMutation.isPending

  async function resolvePlaybookFormForSave(form, entity) {
    const sendingProfileValue = String(form.sendingProfile || '')
    if (!sendingProfileValue.startsWith('gophish:')) return form

    const gophishId = Number(sendingProfileValue.replace('gophish:', ''))
    if (!gophishId) return { ...form, sendingProfile: '' }

    const existingRef = sendingProfiles.find(profile => (
      Number(profile.gophish_sending_profile_id || 0) === gophishId
    ))

    if (existingRef?.id) {
      return { ...form, sendingProfile: String(existingRef.id) }
    }

    const gophishProfile = gophishSmtpProfiles.find(profile => Number(profile.id) === gophishId)
    const createdRef = await masterAssetApi.createSendingProfile({
      name: gophishProfile?.name || `GoPhish SMTP ${gophishId}`,
      gophish_sending_profile_id: gophishId,
      from_email: gophishProfile?.from_address || gophishProfile?.from || '',
      from_name: gophishProfile?.name || '',
      entity: entity || GENERAL_ENTITY,
      environment: 'production',
      status: 'active',
      allowed_domains: [],
    })

    await refetchSendingProfiles()

    return { ...form, sendingProfile: String(createdRef.id) }
  }

  function playbookLockMessage(item) {
    const count = Number(item?.activeCampaignRunCount || 0)
    if (count > 0) {
      return `Playbook is locked because it is used by ${count} active Campaign Run${count > 1 ? 's' : ''}.`
    }

    return item?.editLockReason || 'Playbook is locked while it is used by an active Campaign Run.'
  }

  function notifyPlaybookLocked(item) {
    toast.error(playbookLockMessage(item))
  }

  function saveAssignment(nextAssignment) {
    if (type === 'playbooks') {
      if (editing.editLocked) {
        notifyPlaybookLocked(editing)
        return
      }

      const result = entityFromAssignment(nextAssignment, users)
      if (result.error) {
        toast.error(result.error)
        return
      }

      updatePlaybookMutation.mutate({
        id: editing.id,
        data: buildPlaybookPayloadFromRow(editing.raw, { entity: result.entity }),
      })
      return
    }

    setItems(current => current.map(item => (
      item.id === editing.id ? { ...item, ...nextAssignment } : item
    )))
    toast.success('Assignment updated.')
    setEditing(null)
  }

  async function updatePlaybookFromForm(form) {
    if (editingPlaybook.editLocked) {
      notifyPlaybookLocked(editingPlaybook)
      return
    }

    const result = entityFromAssignment(form, users)
    if (result.error) {
      toast.error(result.error)
      return
    }

    setSavingPlaybook(true)
    try {
      const resolvedForm = await resolvePlaybookFormForSave(form, result.entity)
      updatePlaybookMutation.mutate({
        id: editingPlaybook.id,
        data: buildPlaybookPayloadFromForm(resolvedForm, result.entity),
      })
    } catch (error) {
      toast.error(error.message || 'Failed to prepare playbook master.')
    } finally {
      setSavingPlaybook(false)
    }
  }

  function clonePlaybook(item) {
    duplicatePlaybookMutation.mutate({
      id: item.id,
      data: {
        name: `Copy of ${item.name}`,
        entity: item.raw?.entity || item.entity || GENERAL_ENTITY,
      },
    })
  }

  function deletePlaybook(item) {
    if (item.editLocked) {
      notifyPlaybookLocked(item)
      return
    }

    setDeletingPlaybook(item)
  }

  function confirmDeletePlaybook() {
    if (!deletingPlaybook) return

    if (deletingPlaybook.editLocked) {
      notifyPlaybookLocked(deletingPlaybook)
      setDeletingPlaybook(null)
      return
    }

    deletePlaybookMutation.mutate(deletingPlaybook.id)
  }

  function submitPlaybookForReview(item) {
    submitReviewMutation.mutate(item.id)
  }

  function approvePlaybook(item) {
    setApprovingPlaybook(item)
  }

  function confirmApprovePlaybook() {
    if (!approvingPlaybook) return
    approveMutation.mutate(approvingPlaybook.id)
  }

  async function createAsset(asset) {
    if (type === 'playbooks') {
      const result = entityFromAssignment(asset, users)
      if (result.error) {
        toast.error(result.error)
        return
      }

      setSavingPlaybook(true)
      try {
        const resolvedForm = await resolvePlaybookFormForSave(asset, result.entity)
        createPlaybookMutation.mutate(buildPlaybookPayloadFromForm(resolvedForm, result.entity))
      } catch (error) {
        toast.error(error.message || 'Failed to prepare playbook master.')
      } finally {
        setSavingPlaybook(false)
      }
      return
    }

    setItems(current => [asset, ...current])
    setQuery('')
    toast.success(`Asset "${asset.name}" created.`)
    setCreating(false)
  }

  return (
    <PageShell spacing="space-y-5">
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
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                        <span>{item.id}</span>
                        {type === 'playbooks' && item.editLocked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700" title={playbookLockMessage(item)}>
                            <i className="ti ti-lock text-[10px]" />
                            Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{item.metaA}</td>
                <td>{item.metaB}</td>
                <td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                <td><AssignmentSummary item={item} usersById={usersById} /></td>
                <td className="text-right">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => item.editLocked ? notifyPlaybookLocked(item) : setEditing(item)}
                      disabled={type === 'playbooks' && item.editLocked}
                      title={type === 'playbooks' && item.editLocked ? playbookLockMessage(item) : 'Assign'}
                    >
                      <i className="ti ti-user-check" />
                      Assign
                    </Button>
                    {type === 'playbooks' && (
                      <>
                        <TableActionButton
                          icon="ti-edit"
                          label={`Edit ${item.name}`}
                          title={item.editLocked ? playbookLockMessage(item) : 'Edit'}
                          tone="blue"
                          size="md"
                          disabled={item.editLocked}
                          onClick={() => item.editLocked ? notifyPlaybookLocked(item) : setEditingPlaybook(item)}
                        />
                        <TableActionButton
                          icon="ti-copy"
                          label={`Clone ${item.name}`}
                          title="Clone"
                          tone="green"
                          size="md"
                          disabled={duplicatePlaybookMutation.isPending}
                          onClick={() => clonePlaybook(item)}
                        />
                        <TableActionButton
                          icon="ti-trash"
                          label={`Delete ${item.name}`}
                          title={item.editLocked ? playbookLockMessage(item) : 'Delete'}
                          tone="red"
                          size="md"
                          disabled={item.editLocked || deletePlaybookMutation.isPending}
                          onClick={() => deletePlaybook(item)}
                        />
                        {item.rawStatus === 'draft' && canSubmitReviewCapability && (
                          <TableActionButton
                            icon="ti-send"
                            label={`Submit ${item.name} for review`}
                            title={item.editLocked ? playbookLockMessage(item) : 'Submit for review'}
                            tone="blue"
                            size="md"
                            disabled={item.editLocked || submitReviewMutation.isPending}
                            onClick={() => item.editLocked ? notifyPlaybookLocked(item) : submitPlaybookForReview(item)}
                          />
                        )}
                        {item.rawStatus === 'review'
                          && canApproveCapability
                          && Number(currentUser.id) !== Number(item.raw?.created_by)
                          && Number(currentUser.id) !== Number(item.raw?.updated_by) && (
                          <TableActionButton
                            icon="ti-shield-check"
                            label={`Approve ${item.name}`}
                            title="Approve"
                            tone="green"
                            size="md"
                            disabled={approveMutation.isPending}
                            onClick={() => approvePlaybook(item)}
                          />
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  {type === 'playbooks' && playbooksLoading ? 'Loading playbook masters...' : 'No assets found.'}
                </td>
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
      {editingPlaybook && type === 'playbooks' && (
        <CreateAssetPanel
          key={`edit-playbook-${editingPlaybook.id}`}
          type={type}
          config={config}
          users={users}
          componentOptions={componentOptions}
          mode="edit"
          initialForm={playbookFormFromItem(editingPlaybook)}
          saving={playbookFormSaving}
          onClose={() => setEditingPlaybook(null)}
          onCreate={updatePlaybookFromForm}
        />
      )}
      {type === 'playbooks' && deletingPlaybook && (
        <AlertConfirmation
          title="Delete playbook?"
          message={`"${deletingPlaybook.name}" will be archived and removed from the active master playbook list.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deletePlaybookMutation.isPending}
          onCancel={() => setDeletingPlaybook(null)}
          onConfirm={confirmDeletePlaybook}
        />
      )}
      {type === 'playbooks' && approvingPlaybook && (
        <AlertConfirmation
          title="Approve playbook?"
          message={`Approve "${approvingPlaybook.name}"? It will become available for use in campaigns.`}
          icon="ti-shield-check"
          tone="warning"
          confirmLabel="Approve"
          pendingLabel="Approving..."
          isPending={approveMutation.isPending}
          onCancel={() => setApprovingPlaybook(null)}
          onConfirm={confirmApprovePlaybook}
        />
      )}
      {creating && (
        <CreateAssetPanel
          key={`create-${type}`}
          type={type}
          config={config}
          users={users}
          componentOptions={componentOptions}
          saving={type === 'playbooks' ? playbookFormSaving : false}
          onClose={() => setCreating(false)}
          onCreate={createAsset}
        />
      )}
    </PageShell>
  )
}
