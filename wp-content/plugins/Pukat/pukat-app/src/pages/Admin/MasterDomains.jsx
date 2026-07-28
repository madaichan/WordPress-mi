import { useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useMasterDynamicDomains } from '../../hooks/queries/useMasterAssetQueries.js'
import { useTableRows, useTableSchema } from '../../hooks/queries/useTableQueries.js'
import {
  useCreateMasterDynamicDomainMutation,
  useDeleteMasterDynamicDomainMutation,
  useHealthCheckMasterDynamicDomainMutation,
  useUpdateMasterDynamicDomainMutation,
} from '../../hooks/mutations/useMasterAssetMutations.js'
import { DataTable } from '../../components/DataTable/index.js'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'

const TABLE_KEY = 'dynamic_domains'
const DEFAULT_TABLE_STATE = { search: '', sort: 'domain', order: 'asc', page: 1, perPage: 25, filters: {} }

const DOMAIN_TYPES = [
  { value: 'sending', label: 'Sending' },
  { value: 'landing', label: 'Landing page' },
  { value: 'both', label: 'Both' },
]

const DOMAIN_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const AUTHORIZATION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
]

const EMPTY_FORM = {
  name: '',
  type: 'both',
  baseLandingUrl: '',
  trackingUrl: '',
  environment: 'production',
  ownerEntity: 'General',
  status: 'draft',
  authorizationStatus: 'pending',
}

function urlForDomain(domain, path = '') {
  return domain ? `https://${domain}${path}` : ''
}

function formFromRow(row) {
  return {
    name: row.domain || '',
    type: row.type || 'both',
    baseLandingUrl: row.base_landing_url || '',
    trackingUrl: row.tracking_url || '',
    environment: row.environment || 'production',
    ownerEntity: row.owner_entity || 'General',
    status: row.status || 'draft',
    authorizationStatus: row.authorization_status || 'pending',
  }
}

function payloadFromForm(form) {
  const domain = form.name.trim().toLowerCase()
  const baseLandingUrl = form.type === 'sending'
    ? ''
    : form.baseLandingUrl.trim() || urlForDomain(domain)
  const trackingUrl = form.type === 'landing'
    ? ''
    : form.trackingUrl.trim() || urlForDomain(domain, '/track')

  return {
    domain,
    base_landing_url: baseLandingUrl,
    tracking_url: trackingUrl,
    environment: form.environment.trim() || 'production',
    owner_entity: form.ownerEntity.trim() || 'General',
    authorization_status: form.authorizationStatus,
    status: form.status,
  }
}

function SummaryCard({ icon, value, label, tone = 'violet' }) {
  const toneClass = {
    violet: 'bg-violet-100 text-violet-500',
    emerald: 'bg-[#D1FAE5] text-[#059669]',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  }[tone]

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={clsx('flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl', toneClass)}>
        <i className={clsx('ti text-xl', icon)} />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs font-semibold text-gray-500">{label}</div>
      </div>
    </div>
  )
}

function DomainSlideover({ mode, form, sourceDomain, isSaving, onChange, onClose, onSubmit }) {
  if (!mode) return null

  const isEdit = mode === 'edit'
  const isDuplicate = mode === 'duplicate'
  const title = isEdit ? 'Update domain' : isDuplicate ? 'Duplicate domain' : 'Add domain'

  return (
    <Drawer
      onClose={onClose}
      widthClass="max-w-lg"
      title={title}
      subtitle="Save the master domain, then refresh DNS/TLS health when needed."
      icon={
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-500">
          <i className={clsx('ti text-base', isDuplicate ? 'ti-copy' : isEdit ? 'ti-edit' : 'ti-plus')} />
        </div>
      }
      footer={
        <>
          <Button variant="outline" className="ml-auto" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save domain'}</Button>
        </>
      }
    >
      {isDuplicate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          This copy starts as a draft. Use a different domain name before marking it active.
        </div>
      )}

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Domain details</div>
        <div>
          <Label>Domain name</Label>
          <Input
            value={form.name}
            onChange={event => onChange('name', event.target.value)}
            placeholder="example-portal.net"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={form.type} onChange={event => onChange('type', event.target.value)}>
            {DOMAIN_TYPES.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Runtime URLs</div>
        <div>
          <Label>Base landing URL</Label>
          <Input
            value={form.baseLandingUrl}
            onChange={event => onChange('baseLandingUrl', event.target.value)}
            placeholder={`https://${form.name || 'example-portal.net'}`}
          />
        </div>
        <div>
          <Label>Tracking URL</Label>
          <Input
            value={form.trackingUrl}
            onChange={event => onChange('trackingUrl', event.target.value)}
            placeholder={`https://${form.name || 'example-portal.net'}/track`}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Governance</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={event => onChange('status', event.target.value)}>
              {DOMAIN_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Authorization</Label>
            <Select value={form.authorizationStatus} onChange={event => onChange('authorizationStatus', event.target.value)}>
              {AUTHORIZATION_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Owner entity</Label>
            <Input value={form.ownerEntity} onChange={event => onChange('ownerEntity', event.target.value)} placeholder="General" />
          </div>
          <div>
            <Label>Environment</Label>
            <Input value={form.environment} onChange={event => onChange('environment', event.target.value)} placeholder="production" />
          </div>
        </div>
      </section>

      {sourceDomain && (
        <section className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current validation</div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              DNS: {sourceDomain.dns_status || 'unknown'}
            </span>
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              TLS: {sourceDomain.tls_status || 'unknown'}
            </span>
          </div>
        </section>
      )}
    </Drawer>
  )
}

export default function MasterDomains() {
  const [tableState, setTableState] = useState(DEFAULT_TABLE_STATE)
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [sourceDomain, setSourceDomain] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: allDomains = [] } = useMasterDynamicDomains({ placeholderData: previous => previous })
  const { data: schema } = useTableSchema(TABLE_KEY)
  const { data: rowsData, isLoading, isFetching, refetch: refetchRows } = useTableRows(TABLE_KEY, {
    search: tableState.search,
    sort: tableState.sort,
    order: tableState.order,
    page: tableState.page,
    per_page: tableState.perPage,
    filters: tableState.filters,
  })

  const createMutation = useCreateMasterDynamicDomainMutation({ onSuccess: closeSlideover })
  const updateMutation = useUpdateMasterDynamicDomainMutation({ onSuccess: closeSlideover })
  const deleteMutation = useDeleteMasterDynamicDomainMutation()
  const healthCheckMutation = useHealthCheckMasterDynamicDomainMutation()
  const isSaving = createMutation.isPending || updateMutation.isPending

  const tableRows = rowsData?.rows || []

  const summary = useMemo(() => ({
    total: allDomains.length,
    dnsHealthy: allDomains.filter(domain => domain.dns_status === 'healthy').length,
    tlsHealthy: allDomains.filter(domain => domain.tls_status === 'healthy').length,
    available: allDomains.filter(domain => domain.status === 'active' && domain.authorization_status === 'authorized').length,
  }), [allDomains])

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setSourceDomain(null)
    setForm({ ...EMPTY_FORM })
    setSlideoverMode('create')
  }

  function openEdit(row) {
    setSourceDomain(row)
    setForm(formFromRow(row))
    setSlideoverMode('edit')
  }

  function openDuplicate(row) {
    const draftName = `draft-${row.domain}`
    setSourceDomain(row)
    setForm({
      ...formFromRow(row),
      name: draftName,
      baseLandingUrl: row.base_landing_url ? row.base_landing_url.replace(row.domain, draftName) : '',
      trackingUrl: row.tracking_url ? row.tracking_url.replace(row.domain, draftName) : '',
      status: 'draft',
      authorizationStatus: 'pending',
    })
    setSlideoverMode('duplicate')
  }

  function closeSlideover() {
    setSlideoverMode(null)
    setSourceDomain(null)
    setForm({ ...EMPTY_FORM })
  }

  function submitDomain() {
    const name = form.name.trim().toLowerCase()

    if (!name || !name.includes('.')) {
      toast.error('Enter a valid domain name.')
      return
    }

    const isUpdate = slideoverMode === 'edit'
    const payload = payloadFromForm(form)

    if (isUpdate) {
      updateMutation.mutate({ id: sourceDomain.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function validateDomain(row) {
    healthCheckMutation.mutate(row.id)
  }

  function authorizeDomain(row) {
    updateMutation.mutate({
      id: row.id,
      data: {
        status: 'active',
        authorization_status: 'authorized',
      },
    })
  }

  function deleteDomain(row) {
    const confirmed = window.confirm(`Delete domain "${row.domain}"?`)
    if (!confirmed) return

    deleteMutation.mutate(row.id)
  }

  function handleRowAction({ actionKey, row }) {
    if (actionKey === 'edit') openEdit(row)
    else if (actionKey === 'duplicate') openDuplicate(row)
    else if (actionKey === 'validate') validateDomain(row)
    else if (actionKey === 'authorize') authorizeDomain(row)
    else if (actionKey === 'delete') deleteDomain(row)
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      <PageHeader
        title="Domain Management"
        subtitle="Manage lookalike domains for sending and landing page hosting."
        actions={
          <>
            <Button variant="outline" onClick={() => refetchRows()}>
              Refresh list
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <i className="ti ti-plus text-sm" />
              Add domain
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard icon="ti-world" value={summary.total} label="Master domains" tone="violet" />
        <SummaryCard icon="ti-shield-check" value={summary.dnsHealthy} label="DNS healthy" tone="emerald" />
        <SummaryCard icon="ti-lock-exclamation" value={summary.tlsHealthy} label="TLS healthy" tone="amber" />
        <SummaryCard icon="ti-link" value={summary.available} label="Available" tone="blue" />
      </div>

      <DataTable
        tableKey={TABLE_KEY}
        schema={schema}
        rows={tableRows}
        meta={rowsData?.meta}
        state={tableState}
        loading={isLoading}
        refetching={isFetching}
        onStateChange={setTableState}
        onRowAction={handleRowAction}
      />

      <DomainSlideover
        mode={slideoverMode}
        form={form}
        sourceDomain={sourceDomain}
        isSaving={isSaving}
        onChange={updateForm}
        onClose={closeSlideover}
        onSubmit={submitDomain}
      />
    </div>
  )
}
