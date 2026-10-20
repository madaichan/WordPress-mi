import React, { useState, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { useMyProfile } from '../../hooks/queries/useProfileQueries.js'
import { useUpdateProfileMutation, useChangePasswordMutation } from '../../hooks/mutations/useProfileMutations.js'
import { useEntities } from '../../hooks/queries/useEntityQueries.js'
import useAppStore from '../../store/useAppStore.js'
import PageShell from '../../components/Layout/PageShell.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Card from '../../components/UI/Card.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import Tabs from '../../components/UI/Tabs.jsx'
import EmptyState from '../../components/UI/EmptyState.jsx'
import EntityProfileForm from '../../features/entities/EntityProfileForm.jsx'
import EntityEmailDomainsPanel from '../../features/entities/EntityEmailDomainsPanel.jsx'
import EntityLandingDomainsPanel from '../../features/entities/EntityLandingDomainsPanel.jsx'
import EntityReportContactForm from '../../features/entities/EntityReportContactForm.jsx'
import EntityFlagsPanel from '../../features/entities/EntityFlagsPanel.jsx'
import EntityReadinessCard from '../../features/entities/EntityReadinessCard.jsx'
import EntitySummaryCard from '../../features/entities/EntitySummaryCard.jsx'

const logoutUrl = window.PukatData?.logoutUrl || `${window.PukatData?.adminUrl || '/wp-admin/'}wp-login.php?action=logout`

// Self-service home for the user's own entity data — see
// docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14.1.
const TABS = [
  { key: 'account', label: 'My Account', icon: 'ti-user' },
  { key: 'entity', label: 'Entity Profile', icon: 'ti-building' },
  { key: 'guardrails', label: 'Guardrails', icon: 'ti-shield-lock' },
  { key: 'flags', label: 'Flags', icon: 'ti-flag' },
  { key: 'report', label: 'Call Center Report', icon: 'ti-headset' },
]

export default function MyProfile() {
  const { data: profile, isLoading } = useMyProfile()
  const [activeTab, setActiveTab] = useState('account')

  const entityName = String(profile?.entity || '').trim()
  const isGeneralEntity = entityName.toLowerCase() === 'general'
  const isAdmin = useAppStore(state => state.isAdmin())
  const canEditEntityPerm = useAppStore(state => state.hasPermission('master_entities.edit'))
  const canCreateDomainPerm = useAppStore(state => state.hasPermission('domains.create'))
  const canUploadFlagPerm = useAppStore(state => state.hasPermission('flag_examples.upload'))
  const canEditFlagPagePerm = useAppStore(state => state.hasPermission('flag_pages.edit'))
  const canPublishFlagPagePerm = useAppStore(state => state.hasPermission('flag_pages.publish'))

  // Mirrors backend scoping (EntityProfileService::enforce_entity_editable(),
  // MasterComponentService::enforce_write_entity()) only to avoid showing
  // actions that would 403 — the backend is the real enforcement.
  const canEditEntity = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canEditEntityPerm))
  const canManageLanding = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canCreateDomainPerm))
  const canManageFlags = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canUploadFlagPerm))
  const canEditFlagPage = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canEditFlagPagePerm))
  const canPublishFlagPage = Boolean(entityName) && (isAdmin || (!isGeneralEntity && canPublishFlagPagePerm))

  const { data: entities = [], isLoading: isLoadingEntities } = useEntities({ enabled: Boolean(entityName) })
  const ownEntityProfile = useMemo(
    () => entities.find(e => String(e.entity_name).toLowerCase() === entityName.toLowerCase()) || null,
    [entities, entityName]
  )

  const [form, setForm] = useState({ display_name: '', email: '', phone: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
      })
    }
  }, [profile])

  const updateMutation = useUpdateProfileMutation()
  const changePasswordMutation = useChangePasswordMutation({
    onSuccess: () => {
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
      setTimeout(() => { window.location.href = logoutUrl }, 1200)
    },
  })

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
  const updatePasswordField = (key, value) => setPasswordForm(prev => ({ ...prev, [key]: value }))

  const handleSaveProfile = (e) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  const handleChangePassword = (e) => {
    e.preventDefault()
    setPasswordError('')

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    changePasswordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    })
  }

  if (isLoading) {
    return (
      <PageShell spacing="space-y-4" animated={false} className="max-w-2xl">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="h-40 animate-pulse bg-panel-muted" />
        ))}
      </PageShell>
    )
  }

  return (
    <PageShell spacing="space-y-6" className={entityName ? '' : 'max-w-3xl'}>
      <PageHeader title="My Profile" subtitle="Manage your account and your entity's information" />

      {/* Read-only role & entity */}
      <Card>
        <div className="flex items-center gap-4">
          <img
            src={profile?.avatar_url}
            alt="Avatar"
            className="h-14 w-14 rounded-full bg-panel-muted"
          />
          <div>
            <p className="text-sm font-semibold text-ink">{profile?.display_name}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="violet">{profile?.role}</Badge>
              {profile?.entity && <Badge tone="gray">{profile.entity}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {/* Two columns on wide screens: tabs + content, and a sticky sidebar
          with the entity at a glance and its readiness. On narrow screens the
          sidebar stacks above the tabs. */}
      <div className={clsx('grid grid-cols-1 gap-6', entityName && 'lg:grid-cols-3 lg:items-start')}>
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Tabs items={TABS} active={activeTab} onChange={setActiveTab} ariaLabel="My Profile sections" />

          {activeTab === 'account' && (<>
            {/* Profile info */}
            <Card>
              <form onSubmit={handleSaveProfile}>
                <h2 className="text-sm font-semibold text-ink mb-1">Profile Information</h2>
                <p className="text-xs text-ink-muted mb-4">Update your display name, email, and phone number.</p>

                <div className="space-y-4">
                  <div>
                    <Label>Display Name</Label>
                    <Input
                      value={form.display_name}
                      onChange={e => updateField('display_name', e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => updateField('email', e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      type="tel"
                      value={form.phone}
                      onChange={e => updateField('phone', e.target.value)}
                      placeholder="e.g. 08123456789"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Change password */}
            <Card>
              <form onSubmit={handleChangePassword}>
                <h2 className="text-sm font-semibold text-ink mb-1">Change Password</h2>
                <p className="text-xs text-ink-muted mb-4">
                  You will be logged out and need to sign in again after changing your password.
                </p>

                {passwordError && (
                  <p className="mb-3 text-xs text-danger">{passwordError}</p>
                )}

                <div className="space-y-4">
                  <div>
                    <Label>Current Password</Label>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      value={passwordForm.current_password}
                      onChange={e => updatePasswordField('current_password', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.new_password}
                      onChange={e => updatePasswordField('new_password', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Confirm New Password</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={passwordForm.confirm_password}
                      onChange={e => updatePasswordField('confirm_password', e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      changePasswordMutation.isPending ||
                      !passwordForm.current_password ||
                      !passwordForm.new_password
                    }
                  >
                    {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </form>
            </Card>
          </>)}

          {activeTab !== 'account' && !entityName && (
            <Card>
              <EmptyState
                icon="ti-building-off"
                title="Your account is not assigned to an entity"
                description="Entity Profile, Guardrails, Flags and Call Center Report are managed per entity. Ask an admin to assign your entity."
              />
            </Card>
          )}

          {activeTab === 'entity' && entityName && (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-ink">Entity Profile</h2>
              <p className="mb-4 text-xs text-ink-muted">
                {canEditEntity ? 'Description and contact details for your entity.' : 'Read-only — only an admin can edit this entity.'}
              </p>
              {isLoadingEntities ? (
                <p className="text-sm text-ink-faint">Loading...</p>
              ) : ownEntityProfile ? (
                <EntityProfileForm profile={ownEntityProfile} canEdit={canEditEntity} />
              ) : (
                <EmptyState
                  icon="ti-building"
                  title={`No profile yet for "${entityName}"`}
                  description="Entity profiles are created by an admin. Once it exists, you can fill in its details here."
                />
              )}
            </Card>
          )}

          {activeTab === 'guardrails' && entityName && (
            <>
              <Card>
                <h2 className="mb-3 text-sm font-semibold text-ink">Landing page domains</h2>
                <EntityLandingDomainsPanel entityName={entityName} canManage={canManageLanding} />
              </Card>
              <Card>
                <h2 className="mb-3 text-sm font-semibold text-ink">Company email domains</h2>
                <EntityEmailDomainsPanel entityName={entityName} canManage={canEditEntity} canToggle={canEditEntity} />
              </Card>
            </>
          )}

          {activeTab === 'report' && entityName && (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-ink">Call Center Report</h2>
              <p className="mb-4 text-xs text-ink-muted">
                {canEditEntity
                  ? 'Who employees of your entity should contact to report a suspicious email.'
                  : 'Read-only — only an admin can edit this entity.'}
              </p>
              <EntityReportContactForm entityName={entityName} canEdit={canEditEntity} />
            </Card>
          )}

          {activeTab === 'flags' && entityName && (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-ink">Flags</h2>
              <p className="mb-3 text-xs text-ink-muted">
                Build the education page your colleagues see after a simulation, one per Flag category. Write the page in the Editor, check it in Preview, and upload annotated example screenshots in Images.
              </p>
              {!canManageFlags && !canEditFlagPage && <p className="mb-3 text-xs text-ink-muted">Read-only — you can view but not change this entity&apos;s education pages and examples.</p>}
              {/* Admins would otherwise get every entity's data; pin to their own. */}
              <div className="mt-3">
                <EntityFlagsPanel
                  entityName={entityName}
                  adminEntity={isAdmin ? entityName : null}
                  canManageExamples={canManageFlags}
                  canEditPage={canEditFlagPage}
                  canPublishPage={canPublishFlagPage}
                />
              </div>
            </Card>
          )}
        </div>

        {entityName && (
          <aside className="order-first space-y-6 lg:sticky lg:top-4 lg:order-none">
            <EntitySummaryCard entityName={entityName} profile={ownEntityProfile} onOpenTab={setActiveTab} />
            <EntityReadinessCard entityName={entityName} onOpenTab={setActiveTab} compact />
          </aside>
        )}
      </div>
    </PageShell>
  )
}
