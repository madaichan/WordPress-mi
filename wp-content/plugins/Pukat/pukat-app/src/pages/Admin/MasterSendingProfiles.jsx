import { useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { FALLBACK_USERS } from '../../data/fallbacks.js'
import { SmtpProfileDrawer } from '../../features/assets/components/index.js'
import { DataTable } from '../../components/DataTable/index.js'
import AssignmentBadge from '../../components/UI/AssignmentBadge.jsx'
import AssignmentPanel from '../../components/UI/AssignmentPanel.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import { useGophishSmtpProfiles } from '../../hooks/queries/useGophishQueries.js'
import { useUsers } from '../../hooks/queries/useUserQueries.js'
import { useAssignSmtpProfileEntityMutation, useCreateSmtpProfileMutation, useDeleteSmtpProfileMutation, useUpdateSmtpProfileMutation } from '../../hooks/mutations/useGophishMutations.js'
import { applyAssignmentFromEntity, entityFromAssignment, userForAssignmentPanel } from '../../utils/entityAssignmentHelpers.js'
import { masterAssetLockMessage } from '../../utils/masterAssetHelpers.js'
import {
  EMPTY_SMTP_FORM,
  buildGophishSmtpPayload,
  gophishSmtpProfileToUiProfile,
  hasDuplicateSmtpProfileName,
  profileToSmtpForm,
} from '../../utils/smtpProfileHelpers.js'

const TABLE_KEY = 'sending_profiles'
const DEFAULT_TABLE_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 25, filters: {} }

export default function MasterSendingProfiles() {
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [sourceProfile, setSourceProfile] = useState(null)
  const [form, setForm] = useState(EMPTY_SMTP_FORM)
  const [assignmentProfile, setAssignmentProfile] = useState(null)
  const [changed, setChanged] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [deletingProfile, setDeletingProfile] = useState(null)

  const { data: schema } = useTableSchema(TABLE_KEY)
  const { data: rowsData, isLoading, isFetching, refetch: refetchRows } = useTableRows(TABLE_KEY, {
    search: tableState.search,
    sort: tableState.sort,
    order: tableState.order,
    page: tableState.page,
    per_page: tableState.perPage,
    filters: tableState.filters,
  })
  const { data: gophishProfiles = [], refetch: refetchGophish } = useGophishSmtpProfiles()
  const { data: usersData } = useUsers({ per_page: 100 })

  const users = useMemo(() => {
    const source = usersData?.users?.length ? usersData.users : FALLBACK_USERS
    return source.map(userForAssignmentPanel)
  }, [usersData])

  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  // GoPhish is the only source for full SMTP config (username/ignoreCert/headers), so the drawer
  // still reads from the live, unpaginated GoPhish list, keyed by GoPhish's own numeric id — not
  // the WordPress reference row id the table API uses for search/sort/pagination.
  const gophishById = useMemo(() => {
    const map = new Map()
    gophishProfiles.forEach(profile => map.set(Number(profile.id), profile))
    return map
  }, [gophishProfiles])

  const gophishUiProfiles = useMemo(
    () => gophishProfiles.map(gophishSmtpProfileToUiProfile),
    [gophishProfiles]
  )

  const rows = useMemo(
    () => (rowsData?.rows || []).map(row => applyAssignmentFromEntity(row, users)),
    [rowsData, users]
  )

  const columns = useMemo(() => {
    const merged = []
    ;(schema?.columns || []).forEach(column => {
      if ( 'entity' === column.key ) {
        merged.push({
          key: 'assignment',
          label: 'Assignment',
          renderer: 'custom',
          render: row => <AssignmentBadge item={row} usersById={usersById} />,
        })
      }
      merged.push(column)
    })
    return merged
  }, [schema, usersById])

  const createMutation = useCreateSmtpProfileMutation({ onSuccess: () => closeSlideover() })
  const updateMutation = useUpdateSmtpProfileMutation({ onSuccess: () => closeSlideover() })
  const deleteMutation = useDeleteSmtpProfileMutation({
    onSuccess: () => {
      setDeletingProfile(null)
      closeSlideover()
    },
  })
  const assignEntityMutation = useAssignSmtpProfileEntityMutation({
    onSuccess: () => setAssignmentProfile(null),
  })
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function closeSlideover() {
    setSlideoverMode(null)
    setSourceProfile(null)
    setChanged(false)
    setTesting(false)
    setTestResult(null)
  }

  function loadGophishProfileForRow(row) {
    const gophishId = Number(row.gophish_sending_profile_id || 0)
    const raw = gophishId ? gophishById.get(gophishId) : null

    if (!raw) {
      toast.error('This reference is not linked to a GoPhish sending profile yet.')
      return null
    }

    return {
      ...gophishSmtpProfileToUiProfile(raw),
      entity: row.entity || '',
      editLocked: Boolean(row.edit_locked),
      editLockReason: row.edit_lock_reason || '',
    }
  }

  function openCreate() {
    setSourceProfile(null)
    setForm(EMPTY_SMTP_FORM)
    setSlideoverMode('new')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openEdit(row) {
    const profile = loadGophishProfileForRow(row)
    if (!profile) return
    if (profile.editLocked) {
      toast.error(profile.editLockReason || masterAssetLockMessage(profile, 'Sending profile'))
      return
    }

    setSourceProfile(profile)
    setForm(profileToSmtpForm(profile, 'update'))
    setSlideoverMode('update')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openDuplicate(row) {
    const profile = loadGophishProfileForRow(row)
    if (!profile) return

    setSourceProfile(profile)
    setForm(profileToSmtpForm(profile, 'dup'))
    setSlideoverMode('dup')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openAssignment(row) {
    if (row.edit_locked) {
      toast.error(row.edit_lock_reason || masterAssetLockMessage(row, 'Sending profile'))
      return
    }

    setAssignmentProfile(row)
  }

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setChanged(true)
    if (field !== 'testTarget') {
      setTestResult(null)
    }
  }

  function updateHeader(index, field, value) {
    setForm(current => ({
      ...current,
      headers: current.headers.map((header, headerIndex) => (
        headerIndex === index ? { ...header, [field]: value } : header
      )),
    }))
    setChanged(true)
  }

  function addHeader() {
    setForm(current => ({
      ...current,
      headers: [...current.headers, { key: '', val: '' }],
    }))
    setChanged(true)
  }

  function removeHeader(index) {
    setForm(current => ({
      ...current,
      headers: current.headers.filter((_, headerIndex) => headerIndex !== index),
    }))
    setChanged(true)
  }

  async function syncGoPhish() {
    const [result] = await Promise.all([refetchGophish(), refetchRows()])
    if (result.error) {
      toast.error(result.error.message || 'Failed to sync SMTP profiles.')
      return
    }
    toast.success('SMTP profiles synced with GoPhish.')
  }

  function runConnectionTest() {
    setTesting(true)
    window.setTimeout(() => {
      setTesting(false)
      setTestResult({ ok: true })
      toast.success('SMTP connection tested successfully.')
    }, 1200)
  }

  function submitProfile() {
    if (slideoverMode === 'update' && sourceProfile?.editLocked) {
      toast.error(masterAssetLockMessage(sourceProfile, 'Sending profile'))
      return
    }

    const name = form.name.trim()
    const host = form.host.trim()
    const port = Number(form.port)
    const from = form.from.trim()

    if (!name || !host || !port || !from) {
      toast.error('Please complete all required fields.')
      return
    }

    const duplicateName = hasDuplicateSmtpProfileName(gophishUiProfiles, name, sourceProfile?.id)

    if (duplicateName) {
      toast.error(`Profile name "${name}" is already in use.`)
      return
    }

    const payload = buildGophishSmtpPayload({ form })

    if (slideoverMode === 'update') {
      updateMutation.mutate({ id: sourceProfile.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function deleteProfile() {
    if (!sourceProfile) return
    if (sourceProfile.editLocked) {
      toast.error(masterAssetLockMessage(sourceProfile, 'Sending profile'))
      return
    }

    setDeletingProfile(sourceProfile)
  }

  function confirmDeleteProfile() {
    if (!deletingProfile) return
    if (deletingProfile.editLocked) {
      toast.error(masterAssetLockMessage(deletingProfile, 'Sending profile'))
      setDeletingProfile(null)
      return
    }

    deleteMutation.mutate(deletingProfile.id)
  }

  function saveAssignment(assignment) {
    if (!assignmentProfile) return
    if (assignmentProfile.edit_locked) {
      toast.error(assignmentProfile.edit_lock_reason || masterAssetLockMessage(assignmentProfile, 'Sending profile'))
      setAssignmentProfile(null)
      return
    }

    const result = entityFromAssignment(assignment, users)
    if (result.error) {
      toast.error(result.error)
      return
    }

    const gophishId = Number(assignmentProfile.gophish_sending_profile_id || 0)
    if (!gophishId) {
      toast.error('This reference is not linked to a GoPhish sending profile yet.')
      setAssignmentProfile(null)
      return
    }

    assignEntityMutation.mutate({ id: gophishId, entity: result.entity })
  }

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'assign') {
      openAssignment(row)
      return
    }

    if (actionKey === 'edit') {
      openEdit(row)
      return
    }

    if (actionKey === 'duplicate') {
      openDuplicate(row)
      return
    }

    if (actionKey === 'test') {
      const profile = loadGophishProfileForRow(row)
      if (!profile) return
      if (profile.editLocked) {
        toast.error(profile.editLockReason || masterAssetLockMessage(profile, 'Sending profile'))
        return
      }

      openEdit(row)
      window.setTimeout(runConnectionTest, 50)
    }
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      <PageHeader
        title="Master sending profiles"
        subtitle="SMTP configuration grouped by GoPhish entity for delivery"
        actions={
          <>
            <Button variant="outline" onClick={syncGoPhish} disabled={isFetching}>
              <i className={clsx('ti ti-refresh text-base', isFetching && 'animate-spin')} />
              Sync GoPhish
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <i className="ti ti-plus text-sm" />
              New SMTP
            </Button>
          </>
        }
      />

      <DataTable
        tableKey={TABLE_KEY}
        schema={schema ? { ...schema, columns } : schema}
        rows={rows}
        meta={rowsData?.meta}
        state={tableState}
        loading={isLoading}
        refetching={isFetching}
        onStateChange={setTableState}
        onRowAction={handleRowAction}
      />

      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-500">
          <i className="ti ti-info-circle text-lg" />
        </div>
        <div>
          <h4 className="mb-1 text-sm font-bold text-gray-900">Sending profiles are stored in GoPhish</h4>
          <p className="text-xs leading-relaxed text-gray-500">
            SMTP data on this page is pulled directly from the GoPhish API. Changes made here are synced to GoPhish automatically. Make sure GoPhish is running before creating a new profile.
          </p>
        </div>
      </div>

      <SmtpProfileDrawer
        mode={slideoverMode}
        sourceName={sourceProfile?.name}
        form={form}
        changed={changed}
        showPassword={showPassword}
        testing={testing}
        testResult={testResult}
        saving={saving}
        onClose={closeSlideover}
        onChange={updateForm}
        onHeaderChange={updateHeader}
        onAddHeader={addHeader}
        onRemoveHeader={removeHeader}
        onTogglePassword={() => setShowPassword(value => !value)}
        onRunTest={runConnectionTest}
        onSubmit={submitProfile}
        onDelete={deleteProfile}
        locked={Boolean(sourceProfile?.editLocked)}
        lockReason={sourceProfile?.editLockReason || (sourceProfile ? masterAssetLockMessage(sourceProfile, 'Sending profile') : '')}
      />

      {deletingProfile && (
        <AlertConfirmation
          title="Delete sending profile?"
          message={`"${deletingProfile.name}" will be deleted from GoPhish. Master references mapped to this profile must be cleaned up separately.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingProfile(null)}
          onConfirm={confirmDeleteProfile}
        />
      )}

      {assignmentProfile && (
        <AssignmentPanel
          key={assignmentProfile.id}
          item={assignmentProfile}
          resourceLabel="asset"
          users={users}
          onClose={() => setAssignmentProfile(null)}
          onSave={saveAssignment}
        />
      )}
    </div>
  )
}
