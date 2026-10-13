import { useState } from 'react'
import toast from 'react-hot-toast'
import { useEntityEmailDomains, useEntityReadiness } from '../../hooks/queries/useEntityQueries.js'
import {
  useAddEntityEmailDomainMutation,
  useRemoveEntityEmailDomainMutation,
  useSetEntityEmailDomainStatusMutation,
} from '../../hooks/mutations/useEntityMutations.js'
import Input from '../../components/UI/Input.jsx'
import Button from '../../components/UI/Button.jsx'
import Badge from '../../components/UI/Badge.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'

/**
 * Container for one entity's recipient email-domain allow-list. Used by My
 * Profile (self-service: add/remove/toggle) and by the admin oversight page
 * (toggle only). The backend (EntityProfileService) is what actually
 * enforces who may do what — these flags only avoid showing actions that
 * would 403.
 */
export default function EntityEmailDomainsPanel({ entityName, canManage = false, canToggle = false }) {
  const [newDomain, setNewDomain] = useState('')
  const [removingDomain, setRemovingDomain] = useState(null)
  const { data: domains = [], isLoading } = useEntityEmailDomains(entityName)
  // Whether an empty list blocks launches (PRD §16) or just disables the check (§11).
  const { data: readiness } = useEntityReadiness(entityName)
  const required = readiness?.email_domain_required !== false
  const addMutation = useAddEntityEmailDomainMutation({ onSuccess: () => setNewDomain('') })
  const removeMutation = useRemoveEntityEmailDomainMutation({ onSuccess: () => setRemovingDomain(null) })
  const statusMutation = useSetEntityEmailDomainStatusMutation()

  function confirmRemove() {
    if (removingDomain) removeMutation.mutate({ entityName, id: removingDomain.id })
  }

  function handleAdd() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) {
      toast.error('Enter a domain first.')
      return
    }
    addMutation.mutate({ entityName, domain })
  }

  const activeCount = domains.filter(d => d.status === 'active').length

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Campaign targets whose email domain is not on the active list are rejected when a Campaign Run is launched.
        {activeCount === 0 && (required
          ? <strong className="text-danger"> No active domain yet — campaigns for this entity cannot be launched until one is added.</strong>
          : ' No active domain yet — this guardrail is currently disabled for this entity.')}
      </p>

      {canManage && (
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={event => setNewDomain(event.target.value)}
            placeholder="company.co.id"
            onKeyDown={event => { if (event.key === 'Enter') handleAdd() }}
          />
          <Button variant="primary" onClick={handleAdd} disabled={addMutation.isPending}>Add</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-gray-400">No email domains registered.</p>
      ) : (
        <ul className="space-y-2">
          {domains.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{d.domain}</span>
                <Badge tone={d.status === 'active' ? 'success' : 'gray'}>{d.status === 'active' ? 'Enabled' : 'Disabled'}</Badge>
              </div>
              <div className="flex items-center gap-3">
                {canToggle && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-violet-600 hover:underline"
                    onClick={() => statusMutation.mutate({ entityName, id: d.id, status: d.status === 'active' ? 'inactive' : 'active' })}
                    disabled={statusMutation.isPending}
                  >
                    {d.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger hover:underline"
                    onClick={() => setRemovingDomain(d)}
                    disabled={removeMutation.isPending}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {removingDomain && (
        <AlertConfirmation
          title="Remove email domain?"
          message={`"${removingDomain.domain}" will be removed from this entity's allowed email domains.${activeCount <= 1 && removingDomain.status === 'active' ? (required ? ' It is the last active domain, so this entity will not be able to launch campaigns.' : ' It is the last active domain, so the email-domain guardrail will be disabled.') : ''}`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Remove"
          pendingLabel="Removing..."
          isPending={removeMutation.isPending}
          onCancel={() => setRemovingDomain(null)}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  )
}
