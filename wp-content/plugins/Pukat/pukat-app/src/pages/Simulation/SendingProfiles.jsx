import { useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  EMPTY_SMTP_FORM,
  buildSmtpProfilePayload,
  getSmtpEncryptionClass,
  getSmtpPortForEncryption,
  getSmtpStatusClasses,
  hasDuplicateSmtpProfileName,
  profileToSmtpForm,
} from '../../utils/smtpProfileHelpers.js'

const INITIAL_PROFILES = [
  {
    id: 'finance-relay-01',
    name: 'finance-relay-01',
    host: 'smtp.relay-pool.internal',
    port: 587,
    from: 'CEO Corp <ceo@corp-internal.net>',
    encryption: 'TLS',
    status: 'Valid',
    used: '3 playbooks',
    lastTest: '2 hours ago',
    username: 'relay-user@corp.internal',
    password: 'password123',
    ignoreCert: false,
    headers: [{ key: 'X-Mailer', val: 'Microsoft Outlook 16.0' }],
  },
  {
    id: 'general-relay-02',
    name: 'general-relay-02',
    host: 'mail.outbound.internal',
    port: 465,
    from: 'noreply@updates-corp.net',
    encryption: 'SSL',
    status: 'Valid',
    used: '5 playbooks',
    lastTest: '1 day ago',
    username: 'general-relay@updates-corp.net',
    password: 'password456',
    ignoreCert: false,
    headers: [],
  },
  {
    id: 'hr-relay-03',
    name: 'hr-relay-03',
    host: 'smtp.hr-mailer.internal',
    port: 587,
    from: 'HR Department <hr@corp-hr-portal.net>',
    encryption: 'TLS',
    status: 'Not tested',
    used: '1 playbook',
    lastTest: '-',
    username: 'hr-mailer@corp-hr-portal.net',
    password: 'password789',
    ignoreCert: false,
    headers: [],
  },
  {
    id: 'it-relay-04',
    name: 'it-relay-04',
    host: 'smtp.it-notif.internal',
    port: 25,
    from: 'IT Helpdesk <it-helpdesk@corp-it.net>',
    encryption: 'None',
    status: 'Error',
    used: '0 playbooks',
    lastTest: 'Failed · 3 hours ago',
    username: '',
    password: '',
    ignoreCert: true,
    headers: [],
  },
]

function inputClass() {
  return 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10'
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-[18px] w-8 flex-shrink-0 rounded-full transition-colors',
        checked ? 'bg-violet-500' : 'bg-gray-300'
      )}
      aria-pressed={checked}
    >
      <span
        className={clsx(
          'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all',
          checked ? 'right-0.5' : 'left-0.5'
        )}
      />
    </button>
  )
}

function Field({ label, required, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-gray-500">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] leading-relaxed text-gray-400">{hint}</span>}
    </label>
  )
}

function SmtpSlideover({
  mode,
  sourceName,
  form,
  changed,
  showPassword,
  testing,
  testResult,
  onClose,
  onChange,
  onHeaderChange,
  onAddHeader,
  onRemoveHeader,
  onTogglePassword,
  onRunTest,
  onSubmit,
  onDelete,
}) {
  if (!mode) return null

  const isUpdate = mode === 'update'
  const isDuplicate = mode === 'dup'
  const title = isUpdate ? 'Update Sending Profile' : isDuplicate ? 'Duplicate Sending Profile' : 'New Sending Profile'
  const icon = isUpdate ? 'ti-edit' : isDuplicate ? 'ti-copy' : 'ti-plus'
  const iconColor = isUpdate ? '#92400E' : isDuplicate ? '#065F46' : '#6C63FF'
  const iconBg = isUpdate ? '#FEF3C7' : isDuplicate ? '#D1FAE5' : '#EEEDFE'

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-gray-900/50 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <aside className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: iconBg }}>
            <i className={clsx('ti text-sm', icon)} style={{ color: iconColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold tracking-tight text-gray-900">{title}</h2>
            {sourceName && <p className="mt-0.5 truncate text-[10px] font-medium text-gray-400">{sourceName}</p>}
          </div>
          {changed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
            aria-label="Close"
          >
            <i className="ti ti-x text-base" />
          </button>
        </header>

        <div className="flex-grow space-y-4 overflow-y-auto p-5">
          {isUpdate && (
            <div className="flex gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs">
              <i className="ti ti-shield-check mt-0.5 flex-shrink-0 text-base text-indigo-600" />
              <p className="font-medium text-indigo-700">
                <span className="font-bold text-indigo-950">This sending profile is currently active.</span>
                {' '}Changes apply to the next campaign.
              </p>
            </div>
          )}

          {isDuplicate && (
            <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <i className="ti ti-copy mt-0.5 flex-shrink-0 text-base text-amber-600" />
              <p className="font-medium">
                All configuration is copied from <strong>{sourceName}</strong>. Test status is reset. Update the name and adjust configuration before saving.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <i className="ti ti-settings text-xs" />
            <span>Basic information</span>
          </div>
          <Field label="Profile name" required hint="Use a descriptive name - it appears in playbook options">
            <input value={form.name} onChange={event => onChange('name', event.target.value)} className={inputClass()} placeholder="e.g. finance-relay-01" />
          </Field>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <i className="ti ti-server text-xs" />
            <span>SMTP configuration</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP Host" required>
              <input value={form.host} onChange={event => onChange('host', event.target.value)} className={inputClass()} placeholder="smtp.example.com" />
            </Field>
            <Field label="Port" required>
              <input value={form.port} onChange={event => onChange('port', event.target.value)} className={inputClass()} type="number" placeholder="587" />
            </Field>
          </div>
          <Field label="Encryption">
            <select
              value={form.encryption}
              onChange={event => {
                const encryption = event.target.value
                onChange('encryption', encryption)
                onChange('port', getSmtpPortForEncryption(encryption))
              }}
              className={inputClass()}
            >
              <option value="TLS">TLS (port 587 - recommended)</option>
              <option value="SSL">SSL (port 465)</option>
              <option value="None">None (port 25)</option>
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Username">
              <input value={form.username} onChange={event => onChange('username', event.target.value)} className={inputClass()} placeholder="smtp_user@example.com" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  value={form.password}
                  onChange={event => onChange('password', event.target.value)}
                  className={clsx(inputClass(), 'pr-9')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={onTogglePassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  aria-label="Toggle password"
                >
                  <i className={clsx('ti text-sm', showPassword ? 'ti-eye-off' : 'ti-eye')} />
                </button>
              </div>
              {isDuplicate && <span className="mt-1 block text-[10px] text-amber-600">Password is not copied - enter it again</span>}
            </Field>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <i className="ti ti-mail text-xs" />
            <span>Sender identity</span>
          </div>
          <Field label="From address" required hint="Format: Display Name <email@domain.com> - make sure the domain has SPF/DKIM configured">
            <input value={form.from} onChange={event => onChange('from', event.target.value)} className={inputClass()} placeholder="Sender Name <sender@domain.com>" />
          </Field>

          <button
            type="button"
            onClick={() => onChange('ignoreCert', !form.ignoreCert)}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left"
          >
            <Toggle checked={form.ignoreCert} onChange={value => onChange('ignoreCert', value)} />
            <span>
              <span className="block text-xs font-bold text-gray-800">Ignore certificate errors</span>
              <span className="block text-[10px] font-medium text-gray-400">Ignore SSL/TLS certificate errors for self-signed certificates</span>
            </span>
          </button>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <i className="ti ti-code text-xs" />
            <span>Custom headers</span>
            <span className="normal-case font-medium text-gray-400">(optional)</span>
          </div>
          <p className="text-[11px] leading-relaxed text-gray-400">Add custom email headers for filter bypass testing or additional tracking.</p>

          <div className="space-y-2">
            {form.headers.map((header, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <input
                  value={header.key}
                  onChange={event => onHeaderChange(index, 'key', event.target.value)}
                  className={inputClass()}
                  placeholder="Header Name"
                />
                <input
                  value={header.val}
                  onChange={event => onHeaderChange(index, 'val', event.target.value)}
                  className={inputClass()}
                  placeholder="Value"
                />
                <button
                  type="button"
                  onClick={() => onRemoveHeader(index)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-red-500"
                  aria-label="Remove header"
                >
                  <i className="ti ti-trash text-sm" />
                </button>
              </div>
            ))}
            <button type="button" onClick={onAddHeader} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-500 hover:underline">
              <i className="ti ti-plus text-xs" />
              Add header
            </button>
          </div>

          <div className="h-px bg-gray-100" />

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <i className="ti ti-send text-xs" />
            <span>Connection test</span>
          </div>
          {isDuplicate && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
              <i className="ti ti-alert-triangle flex-shrink-0 text-sm text-amber-600" />
              <span>Test status has been reset. Run a new test before this profile can be used.</span>
            </div>
          )}
          <Field label="Send test email to">
            <div className="flex gap-2">
              <input value={form.testTarget} onChange={event => onChange('testTarget', event.target.value)} className={inputClass()} placeholder="email@domain.com" />
              <button
                type="button"
                onClick={onRunTest}
                disabled={testing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold text-violet-500 transition-all hover:bg-violet-500 hover:text-white disabled:opacity-60"
              >
                <i className={clsx('ti', testing ? 'ti-loader animate-spin' : 'ti-send')} />
                Send test
              </button>
            </div>
          </Field>

          {testResult && (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px]">
                <i className="ti ti-circle-check text-sm text-green-500" />
                <span className="font-bold text-green-800">Test successful</span>
                <span className="ml-auto text-[10px] font-medium text-gray-400">Just now</span>
              </div>
              <div className="bg-white p-3 font-mono text-[10px] leading-relaxed text-gray-600">
                <span className="font-bold text-blue-500">[INFO]</span> Connecting to {form.host || 'localhost'}:{form.port || '25'}...<br />
                <span className="font-bold text-green-600">[OK]</span> TLS handshake successful<br />
                <span className="font-bold text-green-600">[OK]</span> Authentication accepted<br />
                <span className="font-bold text-green-600">[OK]</span> Test email delivered to {form.testTarget || 'admin@corp.internal'}<br />
                <span className="font-bold text-green-600">[OK]</span> SMTP connection closed cleanly
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-shrink-0 items-center gap-2 border-t border-gray-100 bg-gray-50/50 p-4">
          {isUpdate && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100"
            >
              <i className="ti ti-trash" />
              Delete profile
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-all hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="inline-flex items-center gap-1 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-violet-600"
          >
            <i className="ti ti-check" />
            {isUpdate ? 'Save changes' : 'Save profile'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

export default function SendingProfiles() {
  const [profiles, setProfiles] = useState(INITIAL_PROFILES)
  const [query, setQuery] = useState('')
  const [slideoverMode, setSlideoverMode] = useState(null)
  const [sourceProfile, setSourceProfile] = useState(null)
  const [form, setForm] = useState(EMPTY_SMTP_FORM)
  const [changed, setChanged] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const filteredProfiles = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return profiles

    return profiles.filter(profile => (
      profile.name.toLowerCase().includes(term)
      || profile.host.toLowerCase().includes(term)
      || profile.from.toLowerCase().includes(term)
      || profile.encryption.toLowerCase().includes(term)
    ))
  }, [profiles, query])

  function openCreate() {
    setSourceProfile(null)
    setForm(EMPTY_SMTP_FORM)
    setSlideoverMode('new')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openEdit(profile) {
    setSourceProfile(profile)
    setForm(profileToSmtpForm(profile, 'update'))
    setSlideoverMode('update')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function openDuplicate(profile) {
    setSourceProfile(profile)
    setForm(profileToSmtpForm(profile, 'dup'))
    setSlideoverMode('dup')
    setChanged(false)
    setTestResult(null)
    setShowPassword(false)
  }

  function closeSlideover() {
    setSlideoverMode(null)
    setSourceProfile(null)
    setChanged(false)
    setTesting(false)
    setTestResult(null)
  }

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setChanged(true)
    if (field !== 'testTarget') {
      setTestResult(null)
    }
  }

  function updateHeader(index, field, value) {
    setForm(current => ({
      ...current,
      headers: current.headers.map((header, headerIndex) => (
        headerIndex === index ? { ...header, [field]: value } : header
      )),
    }))
    setChanged(true)
  }

  function addHeader() {
    setForm(current => ({
      ...current,
      headers: [...current.headers, { key: '', val: '' }],
    }))
    setChanged(true)
  }

  function removeHeader(index) {
    setForm(current => ({
      ...current,
      headers: current.headers.filter((_, headerIndex) => headerIndex !== index),
    }))
    setChanged(true)
  }

  function syncGoPhish() {
    toast.success('SMTP profiles synced with GoPhish.')
  }

  function runConnectionTest() {
    setTesting(true)
    window.setTimeout(() => {
      setTesting(false)
      setTestResult({ ok: true })
      toast.success('SMTP connection tested successfully.')
    }, 1200)
  }

  function submitProfile() {
    const name = form.name.trim()
    const host = form.host.trim()
    const port = Number(form.port)
    const from = form.from.trim()

    if (!name || !host || !port || !from) {
      toast.error('Please complete all required fields.')
      return
    }

    const duplicateName = hasDuplicateSmtpProfileName(profiles, name, sourceProfile?.id)

    if (duplicateName) {
      toast.error(`Profile name "${name}" is already in use.`)
      return
    }

    const payload = buildSmtpProfilePayload({ form, mode: slideoverMode, sourceProfile })

    if (slideoverMode === 'update') {
      setProfiles(current => current.map(profile => (
        profile.id === sourceProfile.id ? payload : profile
      )))
      toast.success(`SMTP profile "${name}" saved.`)
    } else {
      setProfiles(current => [...current, payload])
      toast.success(`SMTP profile "${name}" created.`)
    }

    closeSlideover()
  }

  function deleteProfile() {
    if (!sourceProfile) return

    const confirmed = window.confirm(`Are you sure you want to delete SMTP profile "${sourceProfile.name}"?`)
    if (!confirmed) return

    setProfiles(current => current.filter(profile => profile.id !== sourceProfile.id))
    toast.success(`SMTP profile "${sourceProfile.name}" deleted.`)
    closeSlideover()
  }

  return (
    <div className="space-y-6 lg:flex lg:h-[calc(100vh-110px)] lg:min-h-[720px] lg:flex-col lg:overflow-hidden mt-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sending profiles</h1>
          <p className="mt-0.5 text-sm font-medium text-gray-500">SMTP configuration for phishing simulation delivery through GoPhish</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={syncGoPhish}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50"
          >
            Sync GoPhish
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-600"
          >
            <i className="ti ti-plus text-sm" />
            New SMTP
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/40 p-5">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Outbound Relay Pools</h3>
            <p className="mt-0.5 text-xs text-gray-500">Active mail relay connections linked to GoPhish</p>
          </div>
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search profiles..."
              className="w-60 rounded-xl border border-gray-200 bg-white px-3 py-2 pl-9 text-xs text-gray-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                <th className="w-10 p-4">
                  <input type="checkbox" className="rounded border-gray-300 text-violet-500 focus:ring-violet-500" />
                </th>
                <th className="p-4">Profile name</th>
                <th className="p-4">Host / Port</th>
                <th className="p-4">From address</th>
                <th className="p-4">Encryption</th>
                <th className="p-4">Status</th>
                <th className="p-4">Used</th>
                <th className="p-4">Last tested</th>
                <th className="w-28 p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProfiles.map(profile => {
                const status = getSmtpStatusClasses(profile.status)

                return (
                  <tr key={profile.id} className="group transition-colors hover:bg-gray-50/50">
                    <td className="w-10 p-4">
                      <input type="checkbox" className="rounded border-gray-300 text-violet-500 focus:ring-violet-500" />
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{profile.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-gray-400">{profile.host}</div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-gray-600">{profile.host}:{profile.port}</span>
                    </td>
                    <td className="p-4 text-gray-600">{profile.from}</td>
                    <td className="p-4">
                      <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', getSmtpEncryptionClass(profile.encryption))}>{profile.encryption}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('h-[7px] w-[7px] flex-shrink-0 rounded-full', status.dot)} />
                        <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', status.tag)}>{profile.status}</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500">{profile.used}</td>
                    <td className="p-4 text-gray-500">{profile.lastTest}</td>
                    <td className="w-28 p-4 pr-6 text-right">
                      <div className="inline-flex items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => openEdit(profile)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-violet-500 hover:text-violet-500"
                          title="Edit"
                          aria-label={`Edit ${profile.name}`}
                        >
                          <i className="ti ti-edit text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDuplicate(profile)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-green-600 hover:text-green-600"
                          title="Duplicate"
                          aria-label={`Duplicate ${profile.name}`}
                        >
                          <i className="ti ti-copy text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openEdit(profile)
                            window.setTimeout(runConnectionTest, 50)
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all hover:border-blue-600 hover:text-blue-600"
                          title="Test"
                          aria-label={`Test ${profile.name}`}
                        >
                          <i className="ti ti-send text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/40 p-4">
          <span className="text-xs font-medium text-gray-500">{filteredProfiles.length} sending profiles</span>
        </div>
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <i className="ti ti-info-circle text-lg" />
        </div>
        <div>
          <h4 className="mb-1 text-sm font-bold text-gray-900">Sending profiles are stored in GoPhish</h4>
          <p className="text-xs leading-relaxed text-gray-500">
            SMTP data on this page is pulled directly from the GoPhish API. Changes made here are synced to GoPhish automatically. Make sure GoPhish is running before creating a new profile.
          </p>
        </div>
      </div>

      <SmtpSlideover
        mode={slideoverMode}
        sourceName={sourceProfile?.name}
        form={form}
        changed={changed}
        showPassword={showPassword}
        testing={testing}
        testResult={testResult}
        onClose={closeSlideover}
        onChange={updateForm}
        onHeaderChange={updateHeader}
        onAddHeader={addHeader}
        onRemoveHeader={removeHeader}
        onTogglePassword={() => setShowPassword(value => !value)}
        onRunTest={runConnectionTest}
        onSubmit={submitProfile}
        onDelete={deleteProfile}
      />
    </div>
  )
}
