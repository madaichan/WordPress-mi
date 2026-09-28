import { useEffect, useState } from 'react'
import { useUpdateEntityMutation } from '../../hooks/mutations/useEntityMutations.js'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Button from '../../components/UI/Button.jsx'
import Select from '../../components/UI/Select.jsx'
import EntityLogoField from './EntityLogoField.jsx'
import { ENTITY_SECTORS } from './entitySectors.js'

function formFromProfile(profile) {
  return {
    display_name: profile?.display_name || '',
    sector: profile?.sector || '',
    employee_count: profile?.employee_count ?? '',
    location: profile?.location || '',
    description: profile?.description || '',
    contact_name: profile?.contact_name || '',
    contact_email: profile?.contact_email || '',
    contact_phone: profile?.contact_phone || '',
  }
}

/**
 * Self-service edit of the logged-in user's own Entity Profile. entity_name
 * and status are deliberately not editable here — name is immutable, and
 * status is an admin concern (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14).
 */
export default function EntityProfileForm({ profile, canEdit }) {
  const [form, setForm] = useState(() => formFromProfile(profile))
  const updateMutation = useUpdateEntityMutation()

  useEffect(() => {
    setForm(formFromProfile(profile))
  }, [profile])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    updateMutation.mutate({ id: profile.id, data: form })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Logo</Label>
        <EntityLogoField profile={profile} canEdit={canEdit} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Entity name</Label>
          <Input value={profile.entity_name} disabled />
        </div>
        <div>
          <Label>Display name</Label>
          <Input
            value={form.display_name}
            onChange={e => update('display_name', e.target.value)}
            placeholder={profile.entity_name}
            disabled={!canEdit}
          />
          <p className="mt-1 text-xs text-gray-500">Shown in reports. Falls back to the entity name.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>Sector</Label>
          <Select value={form.sector} onChange={e => update('sector', e.target.value)} disabled={!canEdit}>
            <option value="">Not set</option>
            {ENTITY_SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
        <div>
          <Label>Employees</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={form.employee_count}
            onChange={e => update('employee_count', e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div>
          <Label>Location</Label>
          <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="Jakarta" disabled={!canEdit} />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Input value={form.description} onChange={e => update('description', e.target.value)} disabled={!canEdit} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Contact name</Label>
          <Input value={form.contact_name} onChange={e => update('contact_name', e.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <Label>Contact phone</Label>
          <Input type="tel" value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      <div>
        <Label>Contact email</Label>
        <Input type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} disabled={!canEdit} />
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save entity profile'}
          </Button>
        </div>
      )}
    </form>
  )
}
