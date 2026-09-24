import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useMasterDynamicDomains } from '../../hooks/queries/useMasterAssetQueries.js'
import {
  useCreateMasterDynamicDomainMutation,
  useDeleteMasterDynamicDomainMutation,
  useHealthCheckMasterDynamicDomainMutation,
} from '../../hooks/mutations/useMasterAssetMutations.js'
import Input from '../../components/UI/Input.jsx'
import Button from '../../components/UI/Button.jsx'
import Badge from '../../components/UI/Badge.jsx'

const AUTH_TONE = { authorized: 'success', pending: 'warning', rejected: 'danger', expired: 'gray' }

/**
 * Container for one entity's landing page domains, on top of the existing
 * /master/dynamic-domains API (already entity-scoped server-side). New
 * domains are always created as draft/pending — an admin authorizes them
 * from Domain Management (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14).
 */
export default function EntityLandingDomainsPanel({ entityName, canManage = false }) {
  const [newDomain, setNewDomain] = useState('')
  const { data: allDomains = [], isLoading } = useMasterDynamicDomains()
  const createMutation = useCreateMasterDynamicDomainMutation({ onSuccess: () => setNewDomain('') })
  const deleteMutation = useDeleteMasterDynamicDomainMutation()
  const healthCheckMutation = useHealthCheckMasterDynamicDomainMutation()

  const domains = useMemo(
    () => allDomains.filter(d => String(d.owner_entity || '').toLowerCase() === String(entityName).toLowerCase()),
    [allDomains, entityName]
  )

  function handleAdd() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain || !domain.includes('.')) {
      toast.error('Enter a valid domain name.')
      return
    }

    // owner_entity must be sent explicitly: the backend defaults a missing
    // value to "General", which it then rejects for non-admin users.
    createMutation.mutate({
      domain,
      base_landing_url: `https://${domain}`,
      tracking_url: `https://${domain}/track`,
      environment: 'production',
      owner_entity: entityName,
      status: 'draft',
      authorization_status: 'pending',
    })
  }

  function handleDelete(domain) {
    if (!window.confirm(`Delete domain "${domain.domain}"?`)) return
    deleteMutation.mutate(domain.id)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Domains used to host this entity&apos;s simulation landing pages. New domains start as pending until an admin authorizes them.
      </p>

      {canManage && (
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={event => setNewDomain(event.target.value)}
            placeholder="simulation.example.com"
            onKeyDown={event => { if (event.key === 'Enter') handleAdd() }}
          />
          <Button variant="primary" onClick={handleAdd} disabled={createMutation.isPending}>Add</Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : domains.length === 0 ? (
        <p className="text-sm text-gray-400">No landing page domains registered for this entity.</p>
      ) : (
        <ul className="space-y-2">
          {domains.map(d => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{d.domain}</span>
                <Badge tone={AUTH_TONE[d.authorization_status] || 'gray'}>{d.authorization_status || 'pending'}</Badge>
                <Badge tone={d.status === 'active' ? 'success' : 'gray'}>{d.status || 'draft'}</Badge>
                <span className="text-[11px] text-gray-400">DNS: {d.dns_status || 'unknown'} · TLS: {d.tls_status || 'unknown'}</span>
              </div>
              {canManage && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-violet-600 hover:underline"
                    onClick={() => healthCheckMutation.mutate(d.id)}
                    disabled={healthCheckMutation.isPending}
                  >
                    Check DNS/TLS
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger hover:underline"
                    onClick={() => handleDelete(d)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
