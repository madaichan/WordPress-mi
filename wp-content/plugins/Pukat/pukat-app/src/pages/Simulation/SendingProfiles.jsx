import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { AssetLockBadge, SmtpProfileDrawer } from '../../features/assets/components/index.js'
import {
  EMPTY_SMTP_FORM,
  buildGophishSmtpPayload,
  gophishSmtpProfileToUiProfile,
  getSmtpEncryptionClass,
  getSmtpStatusClasses,
  hasDuplicateSmtpProfileName,
  profileToSmtpForm,
} from '../../utils/smtpProfileHelpers.js'
import { useGophishSmtpProfiles } from '../../hooks/queries/useGophishQueries.js'
import { useCreateSmtpProfileMutation, useDeleteSmtpProfileMutation, useSendTestSmtpEmailMutation, useUpdateSmtpProfileMutation } from '../../hooks/mutations/useGophishMutations.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Button from '../../components/UI/Button.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import useAppStore from '../../store/useAppStore.js'
import { canManagePukat } from '../../utils/roles.js'
import { assetEntityForUser, canUserCreateAsset, canUserEditAsset, filterAssetsForUser } from '../../utils/entityAssignmentHelpers.js'
import { masterAssetLockMessage } from '../../utils/masterAssetHelpers.js'

const INITIAL_PROFILES = []

export default function SendingProfiles() {
  const { data: gophishProfiles = [], isLoading, isFetching, refetch } = useGophishSmtpProfiles()
  const currentUser = useAppStore(state => state.user)
  const [profiles, setProfiles] = useState(INITIAL_PROFILES)
  const [query, setQuery] = useState('')
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [sourceProfile, setSourceProfile] = useState(null)
  const [form, setForm] = useState(EMPTY_SMTP_FORM)
  const [changed, setChanged] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [deletingProfile, setDeletingProfile] = useState(null)

  const createMutation = useCreateSmtpProfileMutation({ onSuccess: () => closeSlideover() })
  const updateMutation = useUpdateSmtpProfileMutation({ onSuccess: () => closeSlideover() })
  const deleteMutation = useDeleteSmtpProfileMutation({
    onSuccess: () => {
      setDeletingProfile(null)
      closeSlideover()
    },
  })
  const sendTestEmailMutation = useSendTestSmtpEmailMutation()
  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const defaultEntity = useMemo(() => assetEntityForUser(currentUser), [currentUser])
  const canCreateProfiles = useMemo(() => canUserCreateAsset(currentUser), [currentUser])
  const entityLocked = !canManagePukat(currentUser.role)

  useEffect(() => {
    const visibleProfiles = filterAssetsForUser(
      gophishProfiles.map(gophishSmtpProfileToUiProfile),
      currentUser
    )
    setProfiles(visibleProfiles)
  }, [currentUser, gophishProfiles])

  const filteredProfiles = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return profiles

    return profiles.filter(profile => (
      profile.name.toLowerCase().includes(term)
      || profile.host.toLowerCase().includes(term)
      || profile.from.toLowerCase().includes(term)
      || profile.entity.toLowerCase().includes(term)
      || profile.encryption.toLowerCase().includes(term)
    ))
  }, [profiles, query])

  function openCreate() {
    if (!canCreateProfiles) {
      toast.error('User non-admin harus memiliki entity untuk membuat SMTP profile.')
      return
    }

    setSourceProfile(null)
    setForm({ ...EMPTY_SMTP_FORM, entity: defaultEntity })
    setSlideoverMode('new')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openEdit(profile) {
    if (!canUserEditAsset(profile, currentUser)) {
      toast.error('Profile General hanya bisa diedit admin. Non-admin hanya bisa edit profile sesuai entity user.')
      return
    }
    if (profile.editLocked) {
      toast.error(masterAssetLockMessage(profile, 'Sending profile'))
      return
    }

    setSourceProfile(profile)
    setForm(profileToSmtpForm(profile, 'update'))
    setSlideoverMode('update')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openDuplicate(profile) {
    if (!canUserEditAsset(profile, currentUser)) {
      toast.error('Profile General hanya bisa diduplikasi admin. Non-admin hanya bisa memakai editor sesuai entity user.')
      return
    }

    setSourceProfile(profile)
    setForm(profileToSmtpForm(profile, 'dup'))
    setSlideoverMode('dup')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function closeSlideover() {
    setSlideoverMode(null)
    setSourceProfile(null)
    setChanged(false)
    setTesting(false)
    setTestResult(null)
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
    const result = await refetch()
    if (result.error) {
      toast.error(result.error.message || 'Failed to sync SMTP profiles.')
      return
    }
    toast.success('SMTP profiles synced with GoPhish.')
  }

  function runConnectionTest(overrideForm = form, overrideSourceId = sourceProfile?.id) {
    const target = overrideForm.testTarget.trim()
    if (!target) {
      toast.error('Enter a recipient email to send the test to.')
      return
    }

    const smtp = buildGophishSmtpPayload({ form: overrideForm })
    const id = overrideSourceId ? Number(overrideSourceId) : undefined

    setTesting(true)
    setTestResult(null)
    sendTestEmailMutation.mutate({ ...smtp, id, target }, {
      onSuccess: data => {
        setTesting(false)
        setTestResult({ ok: true, message: data?.message || `Test email sent to ${target}.` })
        toast.success('Test email sent successfully.')
      },
      onError: err => {
        setTesting(false)
        setTestResult({ ok: false, message: err.message })
        toast.error(err.message || 'Failed to send test email.')
      },
    })
  }

  function submitProfile() {
    if (slideoverMode === 'update' && !canUserEditAsset(sourceProfile, currentUser)) {
      toast.error('Profile ini hanya bisa diedit oleh admin atau user dengan entity yang sama.')
      return
    }
    if (slideoverMode === 'update' && sourceProfile?.editLocked) {
      toast.error(masterAssetLockMessage(sourceProfile, 'Sending profile'))
      return
    }
    if (slideoverMode !== 'update' && !canCreateProfiles) {
      toast.error('User non-admin harus memiliki entity untuk membuat SMTP profile.')
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

    const duplicateName = hasDuplicateSmtpProfileName(profiles, name, sourceProfile?.id)

    if (duplicateName) {
      toast.error(`Profile name "${name}" is already in use.`)
      return
    }

    const writableForm = entityLocked ? { ...form, entity: defaultEntity } : form
    const payload = buildGophishSmtpPayload({ form: writableForm })

    if (slideoverMode === 'update') {
      updateMutation.mutate({ id: sourceProfile.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function deleteProfile() {
    if (!sourceProfile) return
    if (!canUserEditAsset(sourceProfile, currentUser)) {
      toast.error('Profile ini hanya bisa dihapus oleh admin atau user dengan entity yang sama.')
      return
    }
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
      return
    }

    deleteMutation.mutate(deletingProfile.id)
  }

  return (
    <PageShell animated={false}>
      <PageHeader
        title="Sending profiles"
        subtitle="SMTP configuration for phishing simulation delivery through GoPhish"
        actions={
          <>
            <Button variant="outline" onClick={syncGoPhish} disabled={isFetching}>Sync GoPhish</Button>
            {canCreateProfiles && (
              <Button variant="primary" onClick={openCreate}>
                <i className="ti ti-plus text-sm" />
                New SMTP
              </Button>
            )}
          </>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/40 p-5">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Outbound Relay Pools</h3>
            <p className="mt-0.5 text-xs text-gray-500">Active mail relay connections linked to GoPhish</p>
          </div>
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search profiles..."
              className="w-60 rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-xs text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="w-10 p-4">
                  <input type="checkbox" className="rounded border-gray-300 text-violet-500 focus:ring-violet-500" />
                </th>
                <th className="p-4">Profile name</th>
                <th className="p-4">Host / Port</th>
                <th className="p-4">From address</th>
                <th className="p-4">Entity</th>
                <th className="p-4">Encryption</th>
                <th className="p-4">Status</th>
                <th className="p-4">Used</th>
                <th className="p-4">Last tested</th>
                <th className="w-28 p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-sm text-gray-400">Loading GoPhish SMTP profiles...</td>
                </tr>
              )}
              {!isLoading && filteredProfiles.map(profile => {
                const status = getSmtpStatusClasses(profile.status)
                const canEditProfile = canUserEditAsset(profile, currentUser)
                const lockReason = masterAssetLockMessage(profile, 'Sending profile')

                return (
                  <tr key={profile.id} className="group transition-colors hover:bg-gray-50/50">
                    <td className="w-10 p-4">
                      <input type="checkbox" className="rounded border-gray-300 text-violet-500 focus:ring-violet-500" />
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{profile.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] text-gray-400">{profile.host}</span>
                        <AssetLockBadge locked={profile.editLocked} reason={lockReason} />
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-gray-600">{profile.host}:{profile.port}</span>
                    </td>
                    <td className="p-4 text-gray-600">{profile.from}</td>
                    <td className="p-4">
                      <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', profile.entity ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-700')}>
                        {profile.entity || 'No entity'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', getSmtpEncryptionClass(profile.encryption))}>{profile.encryption}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('h-[7px] w-[7px] flex-shrink-0 rounded-full', status.dot)} />
                        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', status.tag)}>{profile.status}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500">{profile.used}</td>
                    <td className="p-4 text-gray-500">{profile.lastTest}</td>
                    <td className="w-28 p-4 pr-6 text-right">
                      {canEditProfile && (
                        <div className="inline-flex items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEdit(profile)}
                            disabled={profile.editLocked}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-violet-500 hover:text-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                            title={profile.editLocked ? lockReason : 'Edit'}
                            aria-label={`Edit ${profile.name}`}
                          >
                            <i className="ti ti-edit text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDuplicate(profile)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-green-600 hover:text-green-600"
                            title="Duplicate"
                            aria-label={`Duplicate ${profile.name}`}
                          >
                            <i className="ti ti-copy text-xs" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (profile.editLocked) {
                                toast.error(lockReason)
                                return
                              }
                              openEdit(profile)
                              window.setTimeout(() => runConnectionTest(profileToSmtpForm(profile, 'update'), profile.id), 50)
                            }}
                            disabled={profile.editLocked}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title={profile.editLocked ? lockReason : 'Test'}
                            aria-label={`Test ${profile.name}`}
                          >
                            <i className="ti ti-send text-xs" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!isLoading && filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-sm text-gray-400">No SMTP profiles found in GoPhish.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 p-4">
          <span className="text-xs font-medium text-gray-500">{filteredProfiles.length} sending profiles</span>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
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
        entityLocked={entityLocked}
        locked={Boolean(sourceProfile?.editLocked)}
        lockReason={sourceProfile ? masterAssetLockMessage(sourceProfile, 'Sending profile') : ''}
        onClose={closeSlideover}
        onChange={updateForm}
        onHeaderChange={updateHeader}
        onAddHeader={addHeader}
        onRemoveHeader={removeHeader}
        onTogglePassword={() => setShowPassword(value => !value)}
        onRunTest={runConnectionTest}
        onSubmit={submitProfile}
        onDelete={deleteProfile}
      />

      {deletingProfile && (
        <AlertConfirmation
          title="Delete sending profile?"
          message={`Delete "${deletingProfile.name}" from GoPhish?`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingProfile(null)}
          onConfirm={confirmDeleteProfile}
        />
      )}
    </PageShell>
  )
}
