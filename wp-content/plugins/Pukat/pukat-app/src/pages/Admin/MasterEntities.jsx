import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useGuardrailsOverview } from '../../hooks/queries/useEntityQueries.js'
import { useMasterDynamicDomains } from '../../hooks/queries/useMasterAssetQueries.js'
import { useCreateEntityMutation, useDeleteEntityMutation } from '../../hooks/mutations/useEntityMutations.js'
import useAppStore from '../../store/useAppStore.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import PageShell from '../../components/Layout/PageShell.jsx'
import Card from '../../components/UI/Card.jsx'
import { DataTable } from '../../components/DataTable/index.js'
import Badge from '../../components/UI/Badge.jsx'
import Button from '../../components/UI/Button.jsx'
import TableActionMenu from '../../components/UI/TableActionMenu.jsx'
import AlertConfirmation from '../../components/UI/AlertConfirmation.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import EntityEmailDomainsPanel from '../../features/entities/EntityEmailDomainsPanel.jsx'
import EntityFlagExamplesPanel from '../../features/entities/EntityFlagExamplesPanel.jsx'
import { sectorLabel } from '../../features/entities/entitySectors.js'

const EMPTY_FORM = { entity_name: '', description: '' }
const AUTH_TONE = { authorized: 'success', pending: 'warning', rejected: 'danger', expired: 'gray' }
const TABLE_KEY = 'entities'
const DEFAULT_TABLE_STATE = { search: '', sort: 'entity', order: 'asc', page: 1, perPage: 25, filters: {} }
// The guardrails overview endpoint returns an aggregated view (profile + landing-domain +
// email-domain + report-contact + flag-example counts in one row) rather than a plain SQL
// table, so it isn't registered in the backend TableRegistry/server-driven table API like
// `landing_pages` is. It's small (one row per entity), so search/sort/pagination for the
// shared DataTable UI are done client-side here instead.
const SEARCHABLE_FIELDS = ['entity_name', 'display_name', 'description', 'contact_email', 'contact_name', 'location', 'sector_label']

function CountCell({ value, total, label }) {
  const tone = total === 0 ? 'gray' : value === 0 ? 'warning' : 'success'
  return (
    <div className="flex items-center gap-2">
      <Badge tone={tone}>{value}/{total}</Badge>
      <span className="text-xs text-ink-faint">{label}</span>
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
        <p className="mt-1 text-xs text-ink-faint">Must match the entity assigned to its users. Cannot be renamed later.</p>
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
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Landing page domains</div>
          <Link to="/master/domains" className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline">
            Authorize / enable in Domain Management
          </Link>
        </div>
        {landingDomains.length === 0 ? (
          <p className="text-sm text-ink-faint">No landing page domains registered.</p>
        ) : (
          <ul className="space-y-2">
            {landingDomains.map(d => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line-soft px-3 py-2">
                <span className="text-sm font-medium text-ink-soft">{d.domain}</span>
                <Badge tone={AUTH_TONE[d.authorization_status] || 'gray'}>{d.authorization_status || 'pending'}</Badge>
                <Badge tone={d.status === 'active' ? 'success' : 'gray'}>{d.status || 'draft'}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Company email domains</div>
        {/* Admin can also add: with the §16 guardrail on, an entity only admin
            may edit (e.g. General) would otherwise have no way to become launchable. */}
        <EntityEmailDomainsPanel entityName={entity.entity_name} canManage canToggle />
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Flag examples</div>
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
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [deletingEntity, setDeletingEntity] = useState(null)

  const { data: rows = [], isLoading, isFetching, refetch } = useGuardrailsOverview()
  const { data: allLandingDomains = [] } = useMasterDynamicDomains()

  const canCreate = useAppStore(state => state.hasPermission('master_entities.create'))
  const canDelete = useAppStore(state => state.hasPermission('master_entities.delete'))

  const createMutation = useCreateEntityMutation({ onSuccess: closeCreate })
  const deleteMutation = useDeleteEntityMutation({ onSuccess: () => setDeletingEntity(null) })

  const summary = useMemo(() => ({
    entities: rows.length,
    cannotLaunch: rows.filter(r => r.can_launch === false).length,
    withoutLandingDomain: rows.filter(r => r.landing_domains_available === 0).length,
  }), [rows])

  // Row ids are nullable for entities that have guardrail data but no admin-created
  // profile yet (see `has_profile` below) — give every row a stable, unique id so
  // DataTable's row keys/actions never collide.
  const normalizedRows = useMemo(
    () => rows.map(row => ({ ...row, id: row.id ?? `no-profile-${row.entity_name}`, sector_label: sectorLabel(row.sector) })),
    [rows]
  )

  const filteredRows = useMemo(() => {
    const term = tableState.search.trim().toLowerCase()
    if (!term) return normalizedRows
    return normalizedRows.filter(row => SEARCHABLE_FIELDS.some(
      field => String(row[field] || '').toLowerCase().includes(term)
    ))
  }, [normalizedRows, tableState.search])

  const sortedRows = useMemo(() => {
    if (tableState.sort !== 'entity') return filteredRows
    const sorted = [...filteredRows].sort(
      (a, b) => String(a.entity_name || '').localeCompare(String(b.entity_name || ''))
    )
    if (tableState.order === 'desc') sorted.reverse()
    return sorted
  }, [filteredRows, tableState.sort, tableState.order])

  const perPage = tableState.perPage || DEFAULT_TABLE_STATE.perPage
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / perPage))
  const currentPage = Math.min(tableState.page || 1, pageCount)
  const pagedRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sortedRows, currentPage, perPage]
  )
  const tableMeta = { total: sortedRows.length, per_page: perPage, has_next: currentPage < pageCount }

  function renderActionsCell(row) {
    const menuItems = []
    if (!row.has_profile && canCreate) {
      menuItems.push({ key: 'create_profile', label: 'Create profile', icon: 'ti-user-plus' })
    }
    if (row.has_profile && canDelete) {
      menuItems.push({ key: 'delete', label: 'Delete', icon: 'ti-trash' })
    }

    return (
      <div className="inline-flex items-center justify-end gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => setGuardrailsEntity(row)}>
          <i className="ti ti-shield-lock" />
          Guardrails
        </Button>
        {menuItems.length > 0 && (
          <TableActionMenu
            items={menuItems}
            triggerTitle="More Actions"
            onSelect={actionKey => handleRowAction({ actionKey, row })}
          />
        )}
      </div>
    )
  }

  const schema = useMemo(() => ({
    search: { placeholder: 'Search entities...' },
    columns: [
      {
        key: 'entity',
        label: 'Entity',
        renderer: 'custom',
        sortable: true,
        render: row => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-soft bg-panel-subtle">
              {row.logo_url
                ? <img src={row.logo_url} alt="" className="h-full w-full object-contain" />
                : <i className="ti ti-building text-sm text-ink-faint" />}
            </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-ink">{row.display_name || row.entity_name}</span>
              {row.display_name && row.display_name !== row.entity_name && (
                <span className="truncate text-[11px] text-ink-faint">{row.entity_name}</span>
              )}
              {!row.has_profile && (
                <span title="This entity's users registered guardrails, but no admin has created its profile yet.">
                  <Badge tone="warning" className="text-[10px]">No profile</Badge>
                </span>
              )}
            </div>
            {row.description && <div className="truncate text-[11px] text-ink-faint">{row.description}</div>}
          </div>
          </div>
        ),
      },
      {
        key: 'identity',
        label: 'Sector / size',
        renderer: 'custom',
        render: row => (
          row.sector || row.employee_count != null || row.location ? (
            <div className="min-w-0 text-xs">
              <div className="truncate text-ink-muted">{row.sector_label || '—'}</div>
              <div className="truncate text-[11px] text-ink-faint">
                {[row.employee_count != null && `${row.employee_count.toLocaleString()} employees`, row.location].filter(Boolean).join(' · ')}
              </div>
            </div>
          ) : <span className="text-ink-faint">Not filled</span>
        ),
      },
      {
        key: 'contact',
        label: 'Contact',
        renderer: 'custom',
        render: row => (
          row.contact_email || row.contact_name
            ? <span className="text-ink-muted">{row.contact_email || row.contact_name}</span>
            : <span className="text-ink-faint">Not filled</span>
        ),
      },
      {
        key: 'landing_domains',
        label: 'Landing domains',
        renderer: 'custom',
        render: row => <CountCell value={row.landing_domains_available} total={row.landing_domains_total} label="authorized" />,
      },
      {
        key: 'email_domains',
        label: 'Email domains',
        renderer: 'custom',
        render: row => <CountCell value={row.email_domains_active} total={row.email_domains_total} label="enabled" />,
      },
      {
        key: 'launch',
        label: 'Launch',
        renderer: 'custom',
        render: row => (
          <Badge tone={row.can_launch ? 'success' : 'danger'} className="text-[10px]">
            {row.can_launch ? 'Ready' : 'Blocked'}
          </Badge>
        ),
      },
      {
        key: 'report_contact',
        label: 'Report contact',
        renderer: 'custom',
        render: row => (
          <Badge tone={row.report_contact_filled ? 'success' : 'gray'} className="text-[10px]">
            {row.report_contact_filled ? 'Filled' : 'Not filled'}
          </Badge>
        ),
      },
      {
        key: 'flag_examples',
        label: 'Flag examples',
        renderer: 'custom',
        render: row => (
          <Badge tone={row.flag_examples_total > 0 ? 'success' : 'gray'} className="text-[10px]">
            {row.flag_examples_total}
          </Badge>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        renderer: 'custom',
        align: 'right',
        render: row => renderActionsCell(row),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [canCreate, canDelete])

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

  function confirmDelete() {
    if (deletingEntity) deleteMutation.mutate(deletingEntity.id)
  }

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'create_profile') openCreate(row.entity_name)
    else if (actionKey === 'delete') setDeletingEntity(row)
  }

  async function syncEntities() {
    const result = await refetch()
    if (result.error) {
      toast.error(result.error.message || 'Failed to refresh entities.')
      return
    }
    toast.success(`Refresh complete - ${result.data?.length ?? 0} entities`)
  }

  return (
    <PageShell>
      <PageHeader
        title="Master Entities"
        subtitle="Oversight of entities and their guardrails. Entity users manage their own data from My Profile."
        actions={
          <>
            <Button variant="outline" onClick={syncEntities} disabled={isFetching}>
              <i className={clsx('ti ti-refresh text-base', isFetching && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            {canCreate && (
              <Button variant="primary" onClick={() => openCreate()}>
                <i className="ti ti-plus text-sm" />
                Add entity
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><div className="text-2xl font-bold text-ink">{summary.entities}</div><div className="text-xs font-semibold text-ink-muted">Entities</div></Card>
        <Card><div className="text-2xl font-bold text-ink">{summary.withoutLandingDomain}</div><div className="text-xs font-semibold text-ink-muted">Without an authorized landing domain</div></Card>
        <Card><div className="text-2xl font-bold text-ink">{summary.cannotLaunch}</div><div className="text-xs font-semibold text-ink-muted">Cannot launch campaigns (no active email domain)</div></Card>
      </div>

      <DataTable
        tableKey={TABLE_KEY}
        schema={schema}
        rows={pagedRows}
        meta={tableMeta}
        state={{ ...tableState, page: currentPage }}
        loading={isLoading}
        refetching={isFetching && !isLoading}
        onStateChange={setTableState}
        onRowAction={handleRowAction}
      />

      {deletingEntity && (
        <AlertConfirmation
          title="Delete entity?"
          message={`"${deletingEntity.entity_name}" will be deleted. This only removes its profile — playbooks, templates and domains already tagged with this entity name are not affected.`}
          icon="ti-trash"
          tone="danger"
          confirmLabel="Delete"
          pendingLabel="Deleting..."
          isPending={deleteMutation.isPending}
          onCancel={() => setDeletingEntity(null)}
          onConfirm={confirmDelete}
        />
      )}

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
