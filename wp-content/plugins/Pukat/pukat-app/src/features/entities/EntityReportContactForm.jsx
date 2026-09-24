import { useEffect, useState } from 'react'
import { useEntityReportContact } from '../../hooks/queries/useEntityQueries.js'
import { useSaveEntityReportContactMutation } from '../../hooks/mutations/useEntityMutations.js'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Button from '../../components/UI/Button.jsx'

const EMPTY = { contact_name: '', contact_phone: '', contact_email: '' }

/**
 * Self-service call center / phishing report contact for the user's own
 * entity (docs/PRD_AWARENESS_FLAGS_AND_REPORT_CONTACT.md FR-6). The same
 * data is served read-only at /public/report-contact for a future Outlook
 * "Report" add-in.
 */
export default function EntityReportContactForm({ entityName, canEdit }) {
  const { data: contact, isLoading } = useEntityReportContact(entityName)
  const [form, setForm] = useState(EMPTY)
  const saveMutation = useSaveEntityReportContactMutation()

  useEffect(() => {
    setForm({
      contact_name: contact?.contact_name || '',
      contact_phone: contact?.contact_phone || '',
      contact_email: contact?.contact_email || '',
    })
  }, [contact])

  function update(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    saveMutation.mutate({ entityName, data: form })
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Contact / team name</Label>
        <Input value={form.contact_name} onChange={e => update('contact_name', e.target.value)} placeholder="e.g. Security Operations Center" disabled={!canEdit} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Phone</Label>
          <Input type="tel" value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder="e.g. 021-555-0100" disabled={!canEdit} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} placeholder="e.g. soc@company.co.id" disabled={!canEdit} />
        </div>
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save report contact'}
          </Button>
        </div>
      )}
    </form>
  )
}
