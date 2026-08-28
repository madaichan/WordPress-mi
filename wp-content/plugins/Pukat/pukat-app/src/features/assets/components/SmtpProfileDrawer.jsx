import clsx from 'clsx'
import Drawer from '../../../components/UI/Drawer.jsx'
import Button from '../../../components/UI/Button.jsx'
import { getSmtpPortForEncryption } from '../../../utils/smtpProfileHelpers.js'

function inputClass() {
  return 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10'
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx('relative h-[18px] w-8 flex-shrink-0 rounded-full transition-colors', checked ? 'bg-violet-500' : 'bg-gray-300')}
      aria-pressed={checked}
    >
      <span className={clsx('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all', checked ? 'right-0.5' : 'left-0.5')} />
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

export default function SmtpProfileDrawer({
  mode,
  sourceName,
  form,
  changed,
  showPassword,
  testing,
  testResult,
  saving,
  locked = false,
  lockReason = '',
  entityLocked = false,
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
  const iconClass = isUpdate ? 'bg-amber-100 text-amber-800' : isDuplicate ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-500'

  return (
    <Drawer
      onClose={onClose}
      widthClass="max-w-[420px]"
      title={title}
      subtitle={sourceName}
      icon={
        <div className={clsx('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', iconClass)}>
          <i className={clsx('ti text-sm', icon)} />
        </div>
      }
      headerExtra={changed && (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Unsaved changes
        </span>
      )}
      footer={
        <>
          {isUpdate && (
            <Button variant="danger" onClick={onDelete} disabled={saving || locked} title={locked ? lockReason : 'Delete profile'}>
              <i className="ti ti-trash" />
              Delete profile
            </Button>
          )}
          <Button variant="outline" className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} disabled={saving} title="Save profile">
            <i className={clsx('ti', saving ? 'ti-loader animate-spin' : 'ti-check')} />
            {saving ? 'Saving...' : isUpdate ? 'Save changes' : 'Save profile'}
          </Button>
        </>
      }
    >
      {isUpdate && locked && (
        <div className="flex gap-2.5 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs">
          <i className="ti ti-lock mt-0.5 flex-shrink-0 text-base text-amber-600" />
          <p className="font-medium text-amber-700">
            <span className="font-bold text-amber-950">Delete is disabled for this sending profile.</span>
            {' '}{lockReason || 'It is used by a Campaign or Playbook.'} You can still update, assign, test, and clone it.
          </p>
        </div>
      )}

      {isUpdate && !locked && (
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
          <p className="font-medium">All configuration is copied from <strong>{sourceName}</strong>. Test status is reset.</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <i className="ti ti-settings text-xs" />
        <span>Basic information</span>
      </div>
      <Field label="Profile name" required hint="Use a descriptive name that appears in playbook options">
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
              placeholder="Password"
            />
            <button type="button" onClick={onTogglePassword} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600" aria-label="Toggle password">
              <i className={clsx('ti text-sm', showPassword ? 'ti-eye-off' : 'ti-eye')} />
            </button>
          </div>
          {isDuplicate && <span className="mt-1 block text-[10px] text-amber-600">Password is not copied. Enter it again.</span>}
        </Field>
      </div>

      <div className="h-px bg-gray-100" />

      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <i className="ti ti-mail text-xs" />
        <span>Sender identity</span>
      </div>
      <Field label="From address" required hint="GoPhish SMTP expects an email address. Display-name format will be reduced to the mailbox address.">
        <input value={form.from} onChange={event => onChange('from', event.target.value)} className={inputClass()} placeholder="security@example.com" />
      </Field>
      <Field label="Entity">
        <input
          value={form.entity}
          onChange={event => onChange('entity', event.target.value)}
          disabled={entityLocked}
          className={clsx(inputClass(), entityLocked && 'bg-gray-50 text-gray-500')}
          placeholder="EntityA"
        />
      </Field>

      <button type="button" onClick={() => onChange('ignoreCert', !form.ignoreCert)} className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left">
        <Toggle checked={form.ignoreCert} onChange={value => onChange('ignoreCert', value)} />
        <span>
          <span className="block text-xs font-bold text-gray-800">Ignore certificate errors</span>
          <span className="block text-[10px] font-medium text-gray-400">Ignore SSL/TLS certificate errors for self-signed certificates.</span>
        </span>
      </button>

      <div className="h-px bg-gray-100" />

      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        <i className="ti ti-code text-xs" />
        <span>Custom headers</span>
        <span className="font-medium normal-case text-gray-400">(optional)</span>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400">Add custom email headers for filter bypass testing or additional tracking.</p>

      <div className="space-y-2">
        {form.headers.map((header, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input value={header.key} onChange={event => onHeaderChange(index, 'key', event.target.value)} className={inputClass()} placeholder="Header Name" />
            <input value={header.val} onChange={event => onHeaderChange(index, 'val', event.target.value)} className={inputClass()} placeholder="Value" />
            <button type="button" onClick={() => onRemoveHeader(index)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-red-500" aria-label="Remove header">
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
          <button type="button" onClick={onRunTest} disabled={testing} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-semibold text-violet-500 transition-all hover:bg-violet-500 hover:text-white disabled:opacity-60">
            <i className={clsx('ti', testing ? 'ti-loader animate-spin' : 'ti-send')} />
            Send test
          </button>
        </div>
      </Field>

      {testResult && (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <div className={clsx('flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-[11px]', testResult.ok ? 'bg-gray-50' : 'bg-red-50')}>
            <i className={clsx('ti text-sm', testResult.ok ? 'ti-circle-check text-green-500' : 'ti-circle-x text-red-500')} />
            <span className={clsx('font-bold', testResult.ok ? 'text-green-800' : 'text-red-800')}>
              {testResult.ok ? 'Test successful' : 'Test failed'}
            </span>
            <span className="ml-auto text-[10px] font-medium text-gray-400">Just now</span>
          </div>
          <div className="bg-white p-3 font-mono text-[10px] leading-relaxed text-gray-600">
            <span className={clsx('font-bold', testResult.ok ? 'text-green-600' : 'text-red-600')}>
              {testResult.ok ? '[OK]' : '[ERROR]'}
            </span>{' '}
            {testResult.message || (testResult.ok ? `Test email sent to ${form.testTarget}` : 'Failed to send test email.')}
          </div>
        </div>
      )}
    </Drawer>
  )
}
