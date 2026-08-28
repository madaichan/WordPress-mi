import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import { DataTable } from '../../components/DataTable/index.js'
import { resolveRowActions } from '../../components/DataTable/actionRegistry.js'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import Card from '../../components/UI/Card.jsx'
import Checkbox from '../../components/UI/Checkbox.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
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
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import {
  useApprovePlaybookMutation,
  useCreatePlaybookMutation,
  useDeletePlaybookMutation,
  useDuplicatePlaybookMutation,
  useSubmitPlaybookReviewMutation,
  useUpdatePlaybookMutation,
} from '../../hooks/mutations/usePlaybookMutations.js'
import { masterAssetApi } from '../../api/index.js'
import {
  EMPTY_PLAYBOOK_COMPONENT_OPTIONS,
  firstOption,
  optionLabel,
  playbookComponentOptions,
} from '../../utils/playbookComponentOptions.js'
import {
  GENERAL_ENTITY,
  applyAssignmentFromEntity,
  entityFromAssignment,
  userForAssignmentPanel,
} from '../../utils/entityAssignmentHelpers.js'

const TABLE_KEY = 'playbooks'
const DEFAULT_TABLE_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 25, filters: {} }

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

function difficultyScoreFromValue(value) {
  return DIFFICULTY_OPTIONS.find(option => option.value === value)?.score ?? 3
}

function difficultyValueFromScore(score) {
  return DIFFICULTY_OPTIONS.find(option => option.score === Number(score))?.value ?? 'Medium'
}

function difficultyLabelFromValue(value) {
  return DIFFICULTY_OPTIONS.find(option => option.value === value)?.label ?? 'Medium (3/5)'
}

function playbookStatusFromDisplay(status) {
  return status === 'Published' ? 'active' : 'draft'
}

function defaultPlaybookForm(componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS) {
  return {
    name: '',
    status: 'Draft',
    assignedTo: 'all',
    users: [],
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

function playbookFormFromItem(item) {
  const row = item?.raw || {}

  return {
    name: row.name || item?.name || '',
    status: ['active', 'approved'].includes(String(row.status || '').toLowerCase()) ? 'Published' : 'Draft',
    assignedTo: item?.assignedTo || 'all',
    users: item?.users || [],
    description: row.description || '',
    category: row.scenario || 'Credential',
    difficulty: difficultyValueFromScore(row.difficulty || 3),
    targetDepartment: 'All departments',
    emailTemplate: String(row.default_email_template_version_id || ''),
    landingPage: String(row.default_landing_page_version_id || ''),
    sendingProfile: String(row.default_sending_profile_ref_id || ''),
    domain: String(row.default_dynamic_domain_id || ''),
    scenario: row.objective || '',
  }
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

function validatePlaybookForm(form) {
  if (!form.name.trim()) return 'Name is required.'
  if (!form.description.trim()) return 'Description is required.'
  if (!form.scenario.trim()) return 'Scenario narrative is required.'
  if (form.assignedTo === 'specific' && form.users.length === 0) {
    return 'Choose at least one user or assign to all users.'
  }

  return ''
}

function playbookLockMessage(item) {
  const count = Number(item?.activeCampaignRunCount || 0)
  if (count > 0) {
    return `Playbook is locked because it is used by ${count} Campaign Run${count > 1 ? 's' : ''}.`
  }

  return item?.editLockReason || 'Playbook is locked while it is used by a Campaign Run.'
}

/** The heavy `/playbook-masters` list is only used to populate the edit drawer and lock
 * checks — the DataTable itself is driven entirely by the lightweight `playbooks` table_key. */
function richPlaybookFromRow(row, users) {
  const activeCampaignRunCount = Number(row.usage?.active_campaign_run_count || row.active_campaign_run_count || 0)
  const item = {
    id: String(row.id),
    raw: row,
    name: row.name || `Playbook ${row.id}`,
    entity: row.entity || GENERAL_ENTITY,
    editLocked: Boolean(row.edit_locked) || activeCampaignRunCount > 0,
    activeCampaignRunCount,
    editLockReason: row.edit_lock_reason || 'This playbook is used by a Campaign.',
    assignedTo: 'all',
    users: [],
  }

  return applyAssignmentFromEntity(item, users)
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

function PlaybookDrawer({
  mode = 'create',
  initialForm = null,
  users,
  componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS,
  saving = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => initialForm ?? defaultPlaybookForm(componentOptions))
  const [preview, setPreview] = useState(null)
  const isEdit = mode === 'edit'
  const difficultyScore = difficultyScoreFromValue(form.difficulty)

  useEffect(() => {
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
  }, [componentOptions, isEdit])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
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
    const error = validatePlaybookForm(form)
    if (error) {
      toast.error(error)
      return
    }

    onSubmit(form)
  }

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
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
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

export default function MasterPlaybooks() {
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [assignmentId, setAssignmentId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [approvingId, setApprovingId] = useState(null)
  const [savingPlaybook, setSavingPlaybook] = useState(false)

  const { data: usersData } = useUsers({ per_page: 100 })
  const { data: emailTemplates = [] } = useMasterEmailTemplates()
  const { data: landingPages = [] } = useMasterLandingPages()
  const { data: sendingProfiles = [], refetch: refetchSendingProfiles } = useMasterSendingProfiles()
  const { data: dynamicDomains = [] } = useMasterDynamicDomains()
  const { data: gophishSmtpProfiles = [] } = useGophishSmtpProfiles()
  const { data: playbookRows = [] } = usePlaybooks({ placeholderData: previous => previous })

  const { data: schema } = useTableSchema(TABLE_KEY)
  const { data: rowsData, isLoading, isFetching: isFetchingRows } = useTableRows(TABLE_KEY, {
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

  const componentOptions = useMemo(() => (
    playbookComponentOptions({
      emailTemplates,
      landingPages,
      sendingProfiles,
      dynamicDomains,
      gophishSmtpProfiles,
    })
  ), [dynamicDomains, emailTemplates, gophishSmtpProfiles, landingPages, sendingProfiles])

  const richPlaybooks = useMemo(() => (
    Array.isArray(playbookRows)
      ? playbookRows
        .filter(row => row?.status !== 'archived') // matches the `playbooks` table_key's own archived exclusion
        .map(row => richPlaybookFromRow(row, users))
      : []
  ), [playbookRows, users])

  const tableRows = useMemo(
    () => (rowsData?.rows || []).map(row => applyAssignmentFromEntity(row, users)),
    [rowsData, users]
  )

  const allAssigned = richPlaybooks.filter(item => item.assignedTo === 'all').length
  const specificAssigned = richPlaybooks.length - allAssigned

  const createMutation = useCreatePlaybookMutation({ onSuccess: () => setCreating(false) })
  const updateMutation = useUpdatePlaybookMutation({ onSuccess: () => { setEditingId(null); setAssignmentId(null) } })
  const duplicateMutation = useDuplicatePlaybookMutation()
  const deleteMutation = useDeletePlaybookMutation({ onSuccess: () => setDeletingId(null) })
  const submitReviewMutation = useSubmitPlaybookReviewMutation()
  const approveMutation = useApprovePlaybookMutation({ onSuccess: () => setApprovingId(null) })

  const playbookFormSaving = savingPlaybook || createMutation.isPending || updateMutation.isPending

  const editingPlaybook = useMemo(() => (
    richPlaybooks.find(item => item.id === String(editingId)) ?? null
  ), [editingId, richPlaybooks])
  const assignmentPlaybook = useMemo(() => (
    richPlaybooks.find(item => item.id === String(assignmentId)) ?? null
  ), [assignmentId, richPlaybooks])
  const deletingPlaybook = useMemo(() => (
    richPlaybooks.find(item => item.id === String(deletingId)) ?? null
  ), [deletingId, richPlaybooks])
  const approvingPlaybook = useMemo(() => (
    richPlaybooks.find(item => item.id === String(approvingId)) ?? null
  ), [approvingId, richPlaybooks])

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

  function renderActionsCell(row) {
    const resolved = resolveRowActions(row.row_actions)
    const assignAction = resolved.find(action => action.key === 'assign')
    const menuItems = resolved.filter(action => action.key !== 'assign')

    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        {assignAction && (
          <Button
            variant="secondary"
            size="sm"
            disabled={assignAction.disabled}
            title={assignAction.disabled ? assignAction.reason : 'Assign'}
            onClick={() => handleRowAction({ actionKey: 'assign', row })}
          >
            <i className={clsx('ti', assignAction.icon)} />
            Assign
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
      if ('name' === column.key) {
        merged.push({
          ...column,
          renderer: 'custom',
          render: row => (
            <div className="min-w-0">
              <div className="truncate font-semibold text-gray-900">{row.name}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                <span>#{row.id}</span>
                {row.edit_locked && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700" title={row.edit_lock_reason}>
                    <i className="ti ti-lock text-[10px]" />
                    Locked
                  </span>
                )}
              </div>
            </div>
          ),
        })
        return
      }
      merged.push(column)
      if ('entity' === column.key) {
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

  function handleEdit(id) {
    const item = richPlaybooks.find(playbook => playbook.id === String(id))
    if (!item) return
    if (item.editLocked) {
      toast.error(playbookLockMessage(item))
      return
    }

    setEditingId(id)
  }

  function handleDuplicate(id) {
    const item = richPlaybooks.find(playbook => playbook.id === String(id))
    if (!item) return

    duplicateMutation.mutate({
      id,
      data: { name: `Copy of ${item.name}`, entity: item.entity || GENERAL_ENTITY },
    })
  }

  function handleDelete(id) {
    const item = richPlaybooks.find(playbook => playbook.id === String(id))
    if (!item) return
    if (item.editLocked) {
      toast.error(playbookLockMessage(item))
      return
    }

    setDeletingId(id)
  }

  function confirmDelete() {
    if (!deletingPlaybook) return
    if (deletingPlaybook.editLocked) {
      toast.error(playbookLockMessage(deletingPlaybook))
      setDeletingId(null)
      return
    }

    deleteMutation.mutate(deletingPlaybook.id)
  }

  function confirmApprove() {
    if (!approvingPlaybook) return
    approveMutation.mutate(approvingPlaybook.id)
  }

  function handleRowAction({ actionKey, row }) {
    if ('assign' === actionKey) setAssignmentId(row.id)
    else if ('edit' === actionKey) handleEdit(row.id)
    else if ('duplicate' === actionKey) handleDuplicate(row.id)
    else if ('delete' === actionKey) handleDelete(row.id)
    else if ('submit_review' === actionKey) submitReviewMutation.mutate(row.id)
    else if ('approve' === actionKey) setApprovingId(row.id)
  }

  function saveAssignment(nextAssignment) {
    if (!assignmentPlaybook) return
    // Assign is never blocked by Campaign usage — only edit/archive are. Send an
    // entity-only payload (not the full playbook payload) so the backend can tell
    // this apart from a content edit and skip the usage-lock check for it.
    const result = entityFromAssignment(nextAssignment, users)
    if (result.error) {
      toast.error(result.error)
      return
    }

    updateMutation.mutate({ id: assignmentPlaybook.id, data: { entity: result.entity } })
  }

  async function submitPlaybookForm(form) {
    if (editingPlaybook?.editLocked) {
      toast.error(playbookLockMessage(editingPlaybook))
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
      const payload = buildPlaybookPayloadFromForm(resolvedForm, result.entity)

      if (editingId) {
        updateMutation.mutate({ id: editingId, data: payload })
      } else {
        createMutation.mutate(payload)
      }
    } catch (error) {
      toast.error(error.message || 'Failed to prepare playbook master.')
    } finally {
      setSavingPlaybook(false)
    }
  }

  return (
    <PageShell spacing="space-y-5">
      <PageHeader
        title="Master playbooks"
        subtitle="Publish reusable phishing simulation playbooks to selected users."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <i className="ti ti-plus" />
            New playbook
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex items-center gap-4 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-lg text-violet-700">
            <i className="ti ti-book" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{richPlaybooks.length}</div>
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

      {assignmentPlaybook && (
        <AssignmentPanel
          key={assignmentPlaybook.id}
          item={assignmentPlaybook}
          resourceLabel="playbook"
          users={users}
          onClose={() => setAssignmentId(null)}
          onSave={saveAssignment}
        />
      )}

      {(creating || editingPlaybook) && (
        <PlaybookDrawer
          key={editingPlaybook ? `edit-playbook-${editingPlaybook.id}` : 'create-playbook'}
          mode={editingPlaybook ? 'edit' : 'create'}
          initialForm={editingPlaybook ? playbookFormFromItem(editingPlaybook) : undefined}
          users={users}
          componentOptions={componentOptions}
          saving={playbookFormSaving}
          onClose={() => { setCreating(false); setEditingId(null) }}
          onSubmit={submitPlaybookForm}
        />
      )}

      {deletingPlaybook && (
        <AlertConfirmation
          title="Delete playbook?"
          message={`"${deletingPlaybook.name}" will be archived and removed from the active master playbook list.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingId(null)}
          onConfirm={confirmDelete}
        />
      )}

      {approvingPlaybook && (
        <AlertConfirmation
          title="Approve playbook?"
          message={`Approve "${approvingPlaybook.name}"? It will become available for use in campaigns.`}
          icon="ti-shield-check"
          tone="warning"
          confirmLabel="Approve"
          pendingLabel="Approving..."
          isPending={approveMutation.isPending}
          onCancel={() => setApprovingId(null)}
          onConfirm={confirmApprove}
        />
      )}
    </PageShell>
  )
}
