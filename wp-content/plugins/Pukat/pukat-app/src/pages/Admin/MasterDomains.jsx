import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import TableActionButton from '../../components/UI/TableActionButton.jsx'
import PageHeader from '../../components/UI/PageHeader.jsx'
import Button from '../../components/UI/Button.jsx'
import Drawer from '../../components/UI/Drawer.jsx'
import Modal from '../../components/UI/Modal.jsx'
import Label from '../../components/UI/Label.jsx'
import Input from '../../components/UI/Input.jsx'
import Select from '../../components/UI/Select.jsx'
import Textarea from '../../components/UI/Textarea.jsx'

const DOMAIN_TYPES = [
  { value: 'sending', label: 'Sending' },
  { value: 'landing', label: 'Landing page' },
  { value: 'both', label: 'Both' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'pending', label: 'Pending DNS' },
  { value: 'in_use', label: 'In use' },
  { value: 'draft', label: 'Draft' },
  { value: 'dns_issue', label: 'DNS issue' },
  { value: 'ssl_warning', label: 'SSL warning' },
]

const EMPTY_FORM = {
  name: '',
  type: 'both',
  notes: '',
  dynamicPattern: '',
}

const INITIAL_DOMAINS = [
  {
    id: 'domain-corp-portal',
    name: 'corp-portal.net',
    type: 'both',
    notes: 'Primary lookalike domain for Microsoft and HR landing pages.',
    dynamicPattern: 'update-{random}.corp-portal.net',
    dns: { spf: 'pass', dkim: 'pass', mx: 'pass' },
    sslValidUntil: addDays(74),
    availability: 'in_use',
    dependencies: ['Playbook: Microsoft 365 Password Reset', 'Campaign: Q3 Awareness - Active'],
    syncedAt: addHours(-6),
    lastCheckedAt: addHours(-3),
    nextRefreshAt: addHours(21),
  },
  {
    id: 'domain-payroll-secure',
    name: 'payroll-secure.co',
    type: 'landing',
    notes: 'Landing page domain for payroll update simulations.',
    dynamicPattern: 'secure-{random}.payroll-secure.co',
    dns: { spf: 'not_found', dkim: 'not_found', mx: 'pass' },
    sslValidUntil: addDays(23),
    availability: 'pending',
    dependencies: [],
    syncedAt: '',
    lastCheckedAt: addHours(-8),
    nextRefreshAt: addHours(16),
  },
  {
    id: 'domain-benefits-mail',
    name: 'benefits-mail.net',
    type: 'sending',
    notes: 'Sending-only domain for HR benefit notifications.',
    dynamicPattern: '',
    dns: { spf: 'pass', dkim: 'pass', mx: 'pass' },
    sslValidUntil: addDays(148),
    availability: 'available',
    dependencies: [],
    syncedAt: addHours(-22),
    lastCheckedAt: addHours(-2),
    nextRefreshAt: addHours(22),
  },
  {
    id: 'domain-expired-gateway',
    name: 'expired-gateway.net',
    type: 'both',
    notes: 'Draft domain retained for testing failed SSL and DNS paths.',
    dynamicPattern: 'auth-{random}.expired-gateway.net',
    dns: { spf: 'fail', dkim: 'fail', mx: 'not_found' },
    sslValidUntil: addDays(-3),
    availability: 'draft',
    dependencies: [],
    syncedAt: '',
    lastCheckedAt: addHours(-26),
    nextRefreshAt: addMinutes(-5),
  },
]

function addMinutes(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function addHours(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function addDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function nowIso() {
  return new Date().toISOString()
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(value) {
  if (!value) return 'Not synced'
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(value) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

function typeLabel(type) {
  return DOMAIN_TYPES.find(option => option.value === type)?.label ?? type
}

function allDnsPass(dns) {
  return ['spf', 'dkim', 'mx'].every(key => dns[key] === 'pass')
}

function hasDnsIssue(domain) {
  return !allDnsPass(domain.dns)
}

function hasSslWarning(domain) {
  return daysUntil(domain.sslValidUntil) <= 30
}

function inferSslValidUntil(domainName) {
  if (domainName.includes('expired')) return addDays(-3)
  if (domainName.includes('payroll') || domainName.includes('warning')) return addDays(23)
  return addDays(90)
}

function validateDns(domainName) {
  const name = domainName.toLowerCase()

  if (!name.includes('.') || name.includes('draft')) {
    return { spf: 'not_found', dkim: 'not_found', mx: 'not_found' }
  }

  if (name.includes('expired') || name.includes('bad') || name.includes('fail')) {
    return { spf: 'fail', dkim: 'fail', mx: 'not_found' }
  }

  if (name.includes('landing') || name.includes('payroll')) {
    return { spf: 'not_found', dkim: 'not_found', mx: 'pass' }
  }

  return { spf: 'pass', dkim: 'pass', mx: 'pass' }
}

function availabilityFromDns(dns) {
  return allDnsPass(dns) ? 'available' : 'pending'
}

function refreshDomain(domain) {
  const dns = validateDns(domain.name)
  const dependencies = domain.dependencies ?? []
  const availability = dependencies.length
    ? 'in_use'
    : domain.availability === 'draft'
      ? 'draft'
      : availabilityFromDns(dns)

  return {
    ...domain,
    dns,
    availability,
    lastCheckedAt: nowIso(),
    nextRefreshAt: addHours(24),
  }
}

function domainId(name) {
  return `domain-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${Date.now().toString(36)}`
}

function dnsBadgeClass(status) {
  if (status === 'pass') return 'bg-emerald-100 text-emerald-700'
  if (status === 'fail') return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function availabilityClass(status) {
  if (status === 'available') return 'bg-emerald-100 text-emerald-700'
  if (status === 'in_use') return 'bg-blue-100 text-blue-700'
  if (status === 'draft') return 'bg-gray-100 text-gray-700'
  return 'bg-amber-100 text-amber-700'
}

function availabilityLabel(status) {
  if (status === 'in_use') return 'In use'
  if (status === 'pending') return 'Pending DNS'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function DnsBadge({ label, status }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', dnsBadgeClass(status))}>
      <span className="uppercase">{label}</span>
      <span>{status.replace('_', ' ')}</span>
    </span>
  )
}

function SslBadge({ validUntil }) {
  const days = daysUntil(validUntil)

  if (days < 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        Expired {Math.abs(days)}d ago
      </span>
    )
  }

  if (days <= 30) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
        Expires in {days}d
      </span>
    )
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      Valid until {formatDate(validUntil)}
    </span>
  )
}

function TypePill({ type }) {
  const className = {
    sending: 'bg-blue-100 text-blue-700',
    landing: 'bg-emerald-100 text-emerald-700',
    both: 'bg-violet-100 text-violet-500',
  }[type]

  return (
    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', className)}>
      {typeLabel(type)}
    </span>
  )
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

function DomainSlideover({ mode, form, sourceDomain, onChange, onClose, onSubmit }) {
  if (!mode) return null

  const isEdit = mode === 'edit'
  const isDuplicate = mode === 'duplicate'
  const title = isEdit ? 'Update domain' : isDuplicate ? 'Duplicate domain' : 'Add domain'

  return (
    <Drawer
      onClose={onClose}
      widthClass="max-w-lg"
      title={title}
      subtitle="DNS checks run automatically when you save."
      icon={
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-500">
          <i className={clsx('ti text-base', isDuplicate ? 'ti-copy' : isEdit ? 'ti-edit' : 'ti-plus')} />
        </div>
      }
      footer={
        <>
          <Button variant="outline" className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit}>Save domain</Button>
        </>
      }
    >
      {isDuplicate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
          This copy starts as a draft. Use a different domain name before syncing it to GoPhish.
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
        <div>
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={event => onChange('notes', event.target.value)}
            className="min-h-[90px] resize-none"
            placeholder="Use case, owner, DNS notes, registrar notes..."
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Dynamic domain pattern</div>
        <div>
          <Label>Pattern</Label>
          <Input
            value={form.dynamicPattern}
            onChange={event => onChange('dynamicPattern', event.target.value)}
            className="font-mono text-xs"
            placeholder={`update-{random}.${form.name || 'example-portal.net'}`}
          />
          <span className="mt-1 block text-[10px] leading-relaxed text-gray-400">
            Use <code className="rounded bg-gray-100 px-1 py-0.5">{'{random}'}</code> to generate a unique subdomain for each campaign.
          </span>
        </div>
      </section>

      {sourceDomain && (
        <section className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Current validation</div>
          <div className="flex flex-wrap gap-1.5">
            <DnsBadge label="SPF" status={sourceDomain.dns.spf} />
            <DnsBadge label="DKIM" status={sourceDomain.dns.dkim} />
            <DnsBadge label="MX" status={sourceDomain.dns.mx} />
          </div>
          <SslBadge validUntil={sourceDomain.sslValidUntil} />
        </section>
      )}
    </Drawer>
  )
}

function BlockedDeleteModal({ domain, onClose }) {
  if (!domain) return null

  return (
    <Modal
      onClose={onClose}
      className="max-w-md"
      icon={
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
          <i className="ti ti-alert-triangle text-base" />
        </div>
      }
      title="Domain cannot be deleted"
      subtitle={`${domain.name} is used by active dependencies.`}
      footer={<Button variant="primary" className="ml-auto" onClick={onClose}>Got it</Button>}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Dependencies</div>
      <div className="mt-2 space-y-2">
        {domain.dependencies.map(item => (
          <div key={item} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
            {item}
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default function MasterDomains() {
  const [domains, setDomains] = useState(INITIAL_DOMAINS)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [sourceDomain, setSourceDomain] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [blockedDelete, setBlockedDelete] = useState(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDomains(current => current.map(domain => (
        new Date(domain.nextRefreshAt).getTime() <= Date.now()
          ? refreshDomain(domain)
          : domain
      )))
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  const summary = useMemo(() => ({
    total: domains.length,
    dnsReady: domains.filter(domain => allDnsPass(domain.dns)).length,
    sslWarnings: domains.filter(hasSslWarning).length,
    inUse: domains.filter(domain => domain.availability === 'in_use').length,
  }), [domains])

  const filteredDomains = useMemo(() => {
    const term = query.trim().toLowerCase()

    return domains.filter(domain => {
      const matchesType = typeFilter === 'all' || domain.type === typeFilter || (typeFilter === 'sending' && domain.type === 'both') || (typeFilter === 'landing' && domain.type === 'both')
      const matchesSearch = !term || domain.name.toLowerCase().includes(term) || domain.notes.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'all'
        || domain.availability === statusFilter
        || (statusFilter === 'dns_issue' && hasDnsIssue(domain))
        || (statusFilter === 'ssl_warning' && hasSslWarning(domain))

      return matchesType && matchesSearch && matchesStatus
    })
  }, [domains, query, statusFilter, typeFilter])

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setSourceDomain(null)
    setForm(EMPTY_FORM)
    setSlideoverMode('create')
  }

  function openEdit(domain) {
    setSourceDomain(domain)
    setForm({
      name: domain.name,
      type: domain.type,
      notes: domain.notes,
      dynamicPattern: domain.dynamicPattern,
    })
    setSlideoverMode('edit')
  }

  function openDuplicate(domain) {
    const draftName = `draft-${domain.name}`
    setSourceDomain(domain)
    setForm({
      name: draftName,
      type: domain.type,
      notes: `${domain.notes} Copy draft.`,
      dynamicPattern: domain.dynamicPattern ? domain.dynamicPattern.replace(domain.name, draftName) : '',
    })
    setSlideoverMode('duplicate')
  }

  function closeSlideover() {
    setSlideoverMode(null)
    setSourceDomain(null)
    setForm(EMPTY_FORM)
  }

  function submitDomain() {
    const name = form.name.trim().toLowerCase()

    if (!name || !name.includes('.')) {
      toast.error('Enter a valid domain name.')
      return
    }

    const duplicate = domains.some(domain => domain.name.toLowerCase() === name && domain.id !== sourceDomain?.id)
    if (duplicate) {
      toast.error(`Domain "${name}" already exists.`)
      return
    }

    const dns = validateDns(name)
    const isUpdate = slideoverMode === 'edit'
    const isDuplicate = slideoverMode === 'duplicate'
    const dependencies = isUpdate ? sourceDomain.dependencies : []
    const availability = dependencies.length
      ? 'in_use'
      : isDuplicate
        ? 'draft'
        : availabilityFromDns(dns)

    const payload = {
      id: isUpdate ? sourceDomain.id : domainId(name),
      name,
      type: form.type,
      notes: form.notes.trim(),
      dynamicPattern: form.dynamicPattern.trim(),
      dns,
      sslValidUntil: isUpdate ? sourceDomain.sslValidUntil : inferSslValidUntil(name),
      availability,
      dependencies,
      syncedAt: isUpdate ? sourceDomain.syncedAt : '',
      lastCheckedAt: nowIso(),
      nextRefreshAt: addHours(24),
    }

    if (isUpdate) {
      setDomains(current => current.map(domain => domain.id === sourceDomain.id ? payload : domain))
      toast.success(`Domain "${name}" updated. DNS validation complete.`)
    } else {
      setDomains(current => [payload, ...current])
      toast.success(`Domain "${name}" added. DNS validation complete.`)
    }

    closeSlideover()
  }

  function validateDomain(domain) {
    setDomains(current => current.map(item => item.id === domain.id ? refreshDomain(item) : item))
    toast.success(`DNS validation refreshed for ${domain.name}.`)
  }

  function syncDomain(domain) {
    if (domain.type === 'landing') {
      toast.error('Landing-only domains cannot be synced as GoPhish sending domains.')
      return
    }

    setDomains(current => current.map(item => item.id === domain.id ? { ...item, syncedAt: nowIso() } : item))
    toast.success(`${domain.name} synced to GoPhish sending profile domain.`)
  }

  function generateSubdomain(domain) {
    if (!domain.dynamicPattern || !domain.dynamicPattern.includes('{random}')) {
      toast.error('Add a dynamic pattern with {random} first.')
      return
    }

    const random = Math.random().toString(36).slice(2, 8)
    const subdomain = domain.dynamicPattern.replace('{random}', random)
    toast.success(`Generated campaign domain: ${subdomain}`)
  }

  function deleteDomain(domain) {
    if (domain.dependencies.length) {
      setBlockedDelete(domain)
      toast.error('Domain is used by active dependencies.')
      return
    }

    const confirmed = window.confirm(`Delete domain "${domain.name}"?`)
    if (!confirmed) return

    setDomains(current => current.filter(item => item.id !== domain.id))
    toast.success(`Domain "${domain.name}" deleted.`)
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4 animate-fade-in">
      <PageHeader
        title="Domain Management"
        subtitle="Manage lookalike domains for sending and landing page hosting."
        actions={
          <>
            <Button variant="outline" onClick={() => setDomains(current => current.map(refreshDomain))}>
              Refresh DNS
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
        <SummaryCard icon="ti-shield-check" value={summary.dnsReady} label="DNS ready" tone="emerald" />
        <SummaryCard icon="ti-lock-exclamation" value={summary.sslWarnings} label="SSL warnings" tone="amber" />
        <SummaryCard icon="ti-link" value={summary.inUse} label="In active use" tone="blue" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 bg-gray-50/40 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Lookalike Domains</h3>
            <p className="mt-0.5 text-xs text-gray-500">DNS, SSL, availability, and GoPhish sync state refresh every 24 hours.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search domains..."
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-xs text-gray-700 outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/10 sm:w-64"
              />
            </div>
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#6C63FF]">
              <option value="all">All types</option>
              {DOMAIN_TYPES.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#6C63FF]">
              {STATUS_FILTERS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="p-4">Domain</th>
                <th className="p-4">Type</th>
                <th className="p-4">DNS checks</th>
                <th className="p-4">SSL/TLS</th>
                <th className="p-4">Availability</th>
                <th className="p-4">Dynamic pattern</th>
                <th className="p-4">GoPhish</th>
                <th className="p-4">Next refresh</th>
                <th className="w-44 p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDomains.map(domain => (
                <tr key={domain.id} className="transition-colors hover:bg-gray-50/60">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-500">
                        <i className="ti ti-world text-sm" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900">{domain.name}</div>
                        <div className="mt-0.5 max-w-xs truncate text-[11px] text-gray-500">{domain.notes || domain.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><TypePill type={domain.type} /></td>
                  <td className="p-4">
                    <div className="flex min-w-[210px] flex-wrap gap-1.5">
                      <DnsBadge label="SPF" status={domain.dns.spf} />
                      <DnsBadge label="DKIM" status={domain.dns.dkim} />
                      <DnsBadge label="MX" status={domain.dns.mx} />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <SslBadge validUntil={domain.sslValidUntil} />
                      <div className="text-[10px] text-gray-400">{formatDate(domain.sslValidUntil)}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', availabilityClass(domain.availability))}>
                      {availabilityLabel(domain.availability)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="block max-w-[220px] truncate font-mono text-[11px] text-gray-500">{domain.dynamicPattern || '-'}</span>
                  </td>
                  <td className="p-4">
                    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', domain.syncedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                      {domain.syncedAt ? 'Synced' : 'Not synced'}
                    </span>
                    <div className="mt-0.5 text-[10px] text-gray-400">{domain.syncedAt ? formatTime(domain.syncedAt) : 'GoPhish pending'}</div>
                  </td>
                  <td className="p-4 text-[11px] text-gray-500">
                    <div>{formatTime(domain.nextRefreshAt)}</div>
                    <div className="text-[10px] text-gray-400">Last: {formatTime(domain.lastCheckedAt)}</div>
                  </td>
                  <td className="w-44 p-4 pr-6 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <TableActionButton icon="ti-edit" label={`Edit ${domain.name}`} title="Edit" onClick={() => openEdit(domain)} />
                      <TableActionButton icon="ti-copy" label={`Duplicate ${domain.name} as draft`} title="Duplicate as draft" tone="green" onClick={() => openDuplicate(domain)} />
                      <TableActionButton icon="ti-shield-check" label={`Validate DNS for ${domain.name}`} title="Validate DNS" tone="blue" onClick={() => validateDomain(domain)} />
                      <TableActionButton icon="ti-sparkles" label={`Generate dynamic subdomain for ${domain.name}`} title="Generate dynamic subdomain" tone="amber" onClick={() => generateSubdomain(domain)} />
                      <TableActionButton icon="ti-cloud-upload" label={`Sync ${domain.name} to GoPhish`} title="Sync to GoPhish" onClick={() => syncDomain(domain)} />
                      <TableActionButton icon="ti-trash" label={`Delete ${domain.name}`} title="Delete" tone="red" onClick={() => deleteDomain(domain)} />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDomains.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-gray-400">No domains found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 p-4">
          <span className="text-xs font-medium text-gray-500">{filteredDomains.length} domains</span>
          <span className="text-xs font-medium text-gray-400">Automatic refresh interval: 24 hours</span>
        </div>
      </div>

      <DomainSlideover
        mode={slideoverMode}
        form={form}
        sourceDomain={sourceDomain}
        onChange={updateForm}
        onClose={closeSlideover}
        onSubmit={submitDomain}
      />

      <BlockedDeleteModal domain={blockedDelete} onClose={() => setBlockedDelete(null)} />
    </div>
  )
}
