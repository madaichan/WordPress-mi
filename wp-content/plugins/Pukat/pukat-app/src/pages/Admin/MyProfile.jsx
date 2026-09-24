import React, { useState, useEffect } from 'react'
import { useMyProfile } from '../../hooks/queries/useProfileQueries.js'
import { useUpdateProfileMutation, useChangePasswordMutation } from '../../hooks/mutations/useProfileMutations.js'
import PageShell from '../../components/Layout/PageShell.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Card from '../../components/UI/Card.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'

const logoutUrl = window.PukatData?.logoutUrl || `${window.PukatData?.adminUrl || '/wp-admin/'}wp-login.php?action=logout`

export default function MyProfile() {
  const { data: profile, isLoading } = useMyProfile()

  const [form, setForm] = useState({ display_name: '', email: '', phone: '' })
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        email:        profile.email        || '',
        phone:        profile.phone        || '',
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
      new_password:      passwordForm.new_password,
    })
  }

  if (isLoading) {
    return (
      <PageShell spacing="space-y-4" animated={false} className="max-w-2xl">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="h-40 animate-pulse bg-gray-100" />
        ))}
      </PageShell>
    )
  }

  return (
    <PageShell spacing="space-y-6" className="max-w-2xl">
      <PageHeader title="My Profile" subtitle="Manage your own account details" />

      {/* Read-only role & entity */}
      <Card>
        <div className="flex items-center gap-4">
          <img
            src={profile?.avatar_url}
            alt="Avatar"
            className="h-14 w-14 rounded-full bg-gray-100"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{profile?.display_name}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="violet">{profile?.role}</Badge>
              {profile?.entity && <Badge tone="gray">{profile.entity}</Badge>}
            </div>
          </div>
        </div>
      </Card>

      {/* Profile info */}
      <Card>
        <form onSubmit={handleSaveProfile}>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Profile Information</h2>
          <p className="text-xs text-gray-500 mb-4">Update your display name, email, and phone number.</p>

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
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Change Password</h2>
          <p className="text-xs text-gray-500 mb-4">
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
    </PageShell>
  )
}
