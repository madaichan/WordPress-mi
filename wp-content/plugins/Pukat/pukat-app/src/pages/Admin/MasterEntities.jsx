import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useGuardrailsOverview } from '../../hooks/queries/useEntityQueries.js'
import { useMasterDynamicDomains } from '../../hooks/queries/useMasterAssetQueries.js'
import { useCreateEntityMutation, useDeleteEntityMutation } from '../../hooks/mutations/useEntityMutations.js'
import useAppStore from '../../store/useAppStore.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Card from '../../components/UI/Card.jsx'
import Table from '../../components/UI/Table.jsx'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import EntityEmailDomainsPanel from '../../features/entities/EntityEmailDomainsPanel.jsx'
import EntityFlagExamplesPanel from '../../features/entities/EntityFlagExamplesPanel.jsx'

const EMPTY_FORM = { entity_name: '', description: '' }
const AUTH_TONE = { authorized: 'success', pending: 'warning', rejected: 'danger', expired: 'gray' }

function CountCell({ value, total, label }) {
  const tone = total === 0 ? 'gray' : value === 0 ? 'warning' : 'success'
  return (
    <div className="flex items-center gap-2">
      <Badge tone={tone}>{value}/{total}</Badge>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}

function CreateEntityDrawer({ open, form, isSaving, onChange, onClose, onSubmit }) {
  if (!open) return null

  return (
    <Drawer
      onClose={onClose}
      title="New entity"
      subtitle="Creates the entity. Its own users then fill in contact details and guardrails from My Profile."
      footer={
        <>
          <Button variant="outline" className="ml-auto" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Create'}</Button>
        </>
      }
    >
      <div>
        <Label required>Entity name</Label>
        <Input value={form.entity_name} onChange={e => onChange('entity_name', e.target.value)} placeholder="e.g. Finance" />
        <p className="mt-1 text-xs text-gray-400">Must match the entity assigned to its users. Cannot be renamed later.</p>
      </div>
      <div>
        <Label>Description</Label>
        <Input value={form.description} onChange={e => onChange('description', e.target.value)} placeholder="Optional" />
      </div>
    </Drawer>
  )
}

function GuardrailsDrawer({ entity, landingDomains, onClose }) {
  if (!entity) return null

  return (
    <Drawer
      onClose={onClose}
      title={`Guardrails — ${entity.entity_name}`}
      subtitle="Oversight view. Entity users manage these from their My Profile page."
      widthClass="max-w-2xl"
    >
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Landing page domains</div>
          <Link to="/master/domains" className="text-xs font-semibold text-violet-600 hover:underline">
            Authorize / enable in Domain Management
          </Link>
        </div>
        {landingDomains.length === 0 ? (
          <p className="text-sm text-gray-400">No landing page domains registered.</p>
        ) : (
          <ul className="space-y-2">
            {landingDomains.map(d => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
                <span className="text-sm font-medium text-gray-700">{d.domain}</span>
                <Badge tone={AUTH_TONE[d.authorization_status] || 'gray'}>{d.authorization_status || 'pending'}</Badge>
                <Badge tone={d.status === 'active' ? 'success' : 'gray'}>{d.status || 'draft'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Company email domains</div>
        <EntityEmailDomainsPanel entityName={entity.entity_name} canToggle />
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Flag examples</div>
        <EntityFlagExamplesPanel adminEntity={entity.entity_name} />
      </section>
    </Drawer>
  )
}

/**
 * Admin oversight for entities and their guardrails
 * (docs/PRD_ENTITY_PROFILE_AND_GUARDRAILS.md §14.2). Admins create/delete
 * entities and enable/disable guardrail entries here; day-to-day editing of
 * an entity's own data happens on that entity's My Profile page.
 */
export default function MasterEntities() {
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [guardrailsEntity, setGuardrailsEntity] = useState(null)

  const { data: rows = [], isLoading } = useGuardrailsOverview()
  const { data: allLandingDomains = [] } = useMasterDynamicDomains()

  const canCreate = useAppStore(state => state.hasPermission('master_entities.create'))
  const canDelete = useAppStore(state => state.hasPermission('master_entities.delete'))

  const createMutation = useCreateEntityMutation({ onSuccess: closeCreate })
  const deleteMutation = useDeleteEntityMutation()

  const summary = useMemo(() => ({
    entities: rows.length,
    withoutEmailGuardrail: rows.filter(r => r.email_domains_active === 0).length,
    withoutLandingDomain: rows.filter(r => r.landing_domains_available === 0).length,
  }), [rows])

  const guardrailsLandingDomains = useMemo(() => {
    if (!guardrailsEntity) return []
    const key = String(guardrailsEntity.entity_name).toLowerCase()
    return allLandingDomains.filter(d => String(d.owner_entity || '').toLowerCase() === key)
  }, [allLandingDomains, guardrailsEntity])

  function openCreate(entityName = '') {
    setForm({ ...EMPTY_FORM, entity_name: entityName })
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
    setForm(EMPTY_FORM)
  }

  function submitCreate() {
    if (!form.entity_name.trim()) {
      toast.error('Entity name is required.')
      return
    }
    createMutation.mutate(form)
  }

  function deleteEntity(row) {
    const confirmed = window.confirm(
      `Delete entity "${row.entity_name}"? This only removes its profile — playbooks, templates and domains already tagged with this entity name are not affected.`
    )
    if (confirmed) deleteMutation.mutate(row.id)
  }

  return (
    <PageShell>
      <PageHeader
        title="Master Entities"
        subtitle="Oversight of entities and their guardrails. Entity users manage their own data from My Profile."
        actions={canCreate && (
          <Button variant="primary" onClick={() => openCreate()}>
            <i className="ti ti-plus text-sm" />
            Add entity
          </Button>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><div className="text-2xl font-bold text-gray-900">{summary.entities}</div><div className="text-xs font-semibold text-gray-500">Entities</div></Card>
        <Card><div className="text-2xl font-bold text-gray-900">{summary.withoutLandingDomain}</div><div className="text-xs font-semibold text-gray-500">Without an authorized landing domain</div></Card>
        <Card><div className="text-2xl font-bold text-gray-900">{summary.withoutEmailGuardrail}</div><div className="text-xs font-semibold text-gray-500">Email-domain guardrail disabled (no active domain)</div></Card>
      </div>

      <Card className="p-0">
        <Table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Contact</th>
              <th>Landing domains</th>
              <th>Email domains</th>
              <th>Report contact</th>
              <th>Flag examples</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(3)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => <td key={j}><div className="h-4 animate-pulse rounded bg-gray-100" /></td>)}</tr>
                ))
              : rows.map(row => (
                  <tr key={row.id ?? `no-profile-${row.entity_name}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{row.entity_name}</span>
                        {!row.has_profile && (
                          <span title="This entity's users registered guardrails, but no admin has created its profile yet.">
                            <Badge tone="warning">No profile</Badge>
                          </span>
                        )}
                      </div>
                      {row.description && <div className="text-xs text-gray-400">{row.description}</div>}
                    </td>
                    <td className="text-gray-500">{row.contact_email || row.contact_name || <span className="text-gray-300">Not filled</span>}</td>
                    <td><CountCell value={row.landing_domains_available} total={row.landing_domains_total} label="authorized" /></td>
                    <td><CountCell value={row.email_domains_active} total={row.email_domains_total} label="enabled" /></td>
                    <td><Badge tone={row.report_contact_filled ? 'success' : 'gray'}>{row.report_contact_filled ? 'Filled' : 'Not filled'}</Badge></td>
                    <td><Badge tone={row.flag_examples_total > 0 ? 'success' : 'gray'}>{row.flag_examples_total}</Badge></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <button type="button" className="text-xs font-semibold text-violet-600 hover:underline" onClick={() => setGuardrailsEntity(row)}>
                          Guardrails
                        </button>
                        {!row.has_profile && canCreate && (
                          <button type="button" className="text-xs font-semibold text-gray-600 hover:underline" onClick={() => openCreate(row.entity_name)}>
                            Create profile
                          </button>
                        )}
                        {row.has_profile && canDelete && (
                          <button type="button" className="text-xs font-semibold text-danger hover:underline" onClick={() => deleteEntity(row)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </Table>
      </Card>

      <CreateEntityDrawer
        open={createOpen}
        form={form}
        isSaving={createMutation.isPending}
        onChange={(field, value) => setForm(current => ({ ...current, [field]: value }))}
        onClose={closeCreate}
        onSubmit={submitCreate}
      />

      <GuardrailsDrawer
        entity={guardrailsEntity}
        landingDomains={guardrailsLandingDomains}
        onClose={() => setGuardrailsEntity(null)}
      />
    </PageShell>
  )
}
