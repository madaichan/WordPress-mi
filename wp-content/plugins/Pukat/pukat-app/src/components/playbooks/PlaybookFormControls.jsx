import clsx from 'clsx'
import ClientPreview from '../Editor/ClientPreview.jsx'

export function playbookFieldClass() {
  return 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-[13px] text-gray-800 outline-none transition-colors focus:border-violet-500'
}

export function PlaybookField({ label, required, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] leading-relaxed text-gray-400">{hint}</span>}
    </label>
  )
}

function normalizeSelectOption(option) {
  if (typeof option === 'string') {
    return { value: option, label: option, description: '' }
  }

  return {
    ...option,
    value: String(option?.value || ''),
    label: option?.label || String(option?.value || ''),
    description: option?.description || '',
  }
}

export function PlaybookComponentSelect({ icon, bg, color, label, value, options = [], emptyLabel = '', onChange, onPreview }) {
  const normalizedOptions = options.map(normalizeSelectOption).filter(option => option.value)
  const currentOption = normalizedOptions.find(option => option.value === String(value || ''))
  const selectOptions = value && !currentOption
    ? [{ value: String(value), label: String(value), description: '' }, ...normalizedOptions]
    : normalizedOptions
  const hasEmptyOption = Boolean(emptyLabel)
  const displayLabel = currentOption?.label || (value ? String(value) : emptyLabel || 'No data in database')
  const displayDescription = currentOption?.description || ''
  const disabled = selectOptions.length === 0 && !hasEmptyOption
  const canPreview = Boolean(onPreview && currentOption && !disabled)

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: bg }}>
          <i className={clsx('ti text-[13px]', icon)} style={{ color }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-gray-800">{label}</span>
          <span className="block truncate text-xs font-medium text-gray-500">{displayLabel}</span>
          {displayDescription && <span className="block truncate text-[10px] font-medium text-gray-400">{displayDescription}</span>}
        </span>
        {canPreview && (
          <button
            type="button"
            onClick={() => onPreview(currentOption)}
            className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] font-semibold text-violet-500 hover:text-violet-600"
          >
            <i className="ti ti-eye" />
            Preview
          </button>
        )}
      </div>
      <div className="border-t border-gray-200 bg-gray-50 p-3">
        <select value={value} onChange={event => onChange(event.target.value)} className={playbookFieldClass()} disabled={disabled}>
          {hasEmptyOption && <option value="">{emptyLabel}</option>}
          {disabled && <option value="">No data in database</option>}
          {selectOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function EmailPreview({ value }) {
  const lower = value.toLowerCase()
  const isHr = lower.includes('hr') || lower.includes('policy') || lower.includes('welfare')
  const isPrize = lower.includes('congratulations') || lower.includes('rewards') || lower.includes('won')
  const isReset = lower.includes('reset') || lower.includes('password') || lower.includes('active directory')
  const isInvoice = lower.includes('invoice') || lower.includes('billing')

  let sender = 'Microsoft Security'
  let subject = 'Action Required: Sync your corporate inbox'
  let accent = '#0067b8'
  let title = 'Security alert'
  let body = 'We detected unusual sign-in activity on your Microsoft 365 account. Verify your session to avoid service interruption.'
  let action = 'Verify account'

  if (isHr) {
    sender = 'HR Benefits'
    subject = 'HR Update: New welfare policy 2025'
    accent = '#059669'
    title = 'New employee welfare policy'
    body = 'A revised benefit policy is ready for review. Please open the attached document and confirm receipt before the end of the week.'
    action = 'Open policy'
  } else if (isPrize) {
    sender = 'Corporate Loyalty'
    subject = 'Congratulations! You won employee rewards'
    accent = '#7c3aed'
    title = 'Employee reward notification'
    body = 'Your monthly performance reward is available. Claim your voucher using the secure portal below.'
    action = 'Claim reward'
  } else if (isReset) {
    sender = 'IT Helpdesk'
    subject = 'CRITICAL: Reset your Active Directory password'
    accent = '#2563eb'
    title = 'Password reset required'
    body = 'An anomaly was detected on your account. Reset your corporate password within one hour to keep access active.'
    action = 'Reset password'
  } else if (isInvoice) {
    sender = 'Executive Office'
    subject = value
    accent = '#dc2626'
    title = 'Invoice approval needed'
    body = 'A vendor payment requires confirmation today. Review the invoice details and submit approval before EOD.'
    action = 'Review invoice'
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">{sender}</span>
            <span className="font-mono text-gray-400">&lt;notification@corp-sim.local&gt;</span>
          </div>
          <span className="text-gray-400">Today, 10:24 AM</span>
        </div>
        <div className="mt-3 text-xs">
          <span className="text-gray-400">Subject: </span>
          <span className="font-semibold text-gray-900">{subject}</span>
        </div>
      </div>
      <div className="p-7">
        <div className="mx-auto max-w-lg border border-gray-100 p-6 text-xs leading-relaxed text-gray-700">
          <div className="mb-4 flex items-center gap-2 font-bold text-gray-700">
            <span className="h-5 w-5 rounded" style={{ backgroundColor: accent }} />
            <span>{sender}</span>
          </div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="mt-3">{body}</p>
          <div className="mt-5 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
            Request ID: SIM-2025-0428<br />
            Recipient: {'{{.Email}}'}
          </div>
          <button
            type="button"
            className="mt-5 rounded px-5 py-2 text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  )
}

export function LandingPreview({ value }) {
  const lower = value.toLowerCase()
  const isInvoice = lower.includes('invoice') || lower.includes('vendor') || lower.includes('billing') || lower.includes('confirmation')
  const isFile = lower.includes('direct file') || lower.includes('download')
  const isHr = lower.includes('hr') || lower.includes('employee')
  const isReset = lower.includes('reset') || lower.includes('password') || lower.includes('it self-service') || lower.includes('helpdesk')
  const isPrize = lower.includes('prize') || lower.includes('claim')

  if (isInvoice) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-gray-900">Invoice Approval Portal</div>
            <div className="text-xs text-gray-500">Finance workflow confirmation</div>
          </div>
          <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">URGENT</span>
        </div>
        <div className="space-y-3">
          <input disabled value="INV-2025-0892" className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-700" />
          <input disabled placeholder="Corporate email" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Approval note" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
        </div>
        <button type="button" className="mt-5 w-full rounded bg-red-600 py-2 text-xs font-bold text-white">Submit approval</button>
      </div>
    )
  }

  if (isFile) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <i className="ti ti-file-download text-xl" />
        </div>
        <h3 className="mt-4 text-base font-bold text-gray-900">HR Policy Document</h3>
        <p className="mt-1 text-xs text-gray-500">Benefit_Update_2025.xlsm</p>
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-[11px] text-gray-500">
          File size: 428 KB<br />
          Source: HR benefits portal
        </div>
        <button type="button" className="mt-5 w-full rounded bg-amber-500 py-2 text-xs font-bold text-white">Download file</button>
      </div>
    )
  }

  if (isHr) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <i className="ti ti-id-badge-2 text-xl" />
          </div>
          <h3 className="mt-3 text-base font-bold text-gray-900">HR Employee Portal</h3>
          <p className="text-xs text-gray-500">Update employee data</p>
        </div>
        <div className="mt-5 space-y-3">
          <input disabled placeholder="Employee ID" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Corporate email" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Phone number" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
        </div>
        <button type="button" className="mt-5 w-full rounded bg-emerald-600 py-2 text-xs font-bold text-white">Update data</button>
      </div>
    )
  }

  if (isReset || isPrize) {
    return (
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-7 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <i className={clsx('ti text-xl', isPrize ? 'ti-gift' : 'ti-key')} />
          </div>
          <h3 className="mt-3 text-base font-bold text-gray-900">{isPrize ? 'Prize Claim Portal' : 'IT Self-Service Password Reset'}</h3>
          <p className="text-xs text-gray-500">{isPrize ? 'Corporate reward verification' : 'Active Directory verification'}</p>
        </div>
        <div className="mt-5 space-y-3">
          <input disabled placeholder="Username / Email" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
          <input disabled placeholder="Password" type="password" className="w-full rounded border border-gray-200 px-3 py-2 text-xs" />
        </div>
        <button type="button" className="mt-5 w-full rounded bg-blue-600 py-2 text-xs font-bold text-white">{isPrize ? 'Claim reward' : 'Reset password'}</button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded border border-gray-300 bg-white p-8 shadow-sm">
      <div className="mb-5 flex items-center gap-2 font-semibold text-gray-500">
        <div className="grid h-4 w-4 grid-cols-2 gap-0.5">
          <span className="bg-[#f25022]" />
          <span className="bg-[#7fba00]" />
          <span className="bg-[#00a4ef]" />
          <span className="bg-[#ffb900]" />
        </div>
        <span>Microsoft</span>
      </div>
      <h3 className="text-base font-semibold text-gray-900">Sign in</h3>
      <input disabled placeholder="Email, phone, or Skype" className="mt-5 w-full border-b border-gray-400 bg-transparent py-2 text-xs outline-none" />
      <div className="mt-6 flex justify-end">
        <button type="button" className="rounded bg-[#0067b8] px-6 py-1.5 text-xs font-semibold text-white">Next</button>
      </div>
    </div>
  )
}

function LandingHtmlPreview({ html, redirectUrl }) {
  return (
    <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex flex-1 select-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-xs text-gray-500">
          <i className="ti ti-lock text-emerald-600" />
          <span className="truncate">{redirectUrl || 'https://portal.office.com'}</span>
        </div>
      </div>
      <div className="flex min-h-[500px] w-full items-center justify-center bg-gray-50 p-4">
        <iframe
          srcDoc={html || '<h3>No HTML content</h3>'}
          title="Landing Page Preview"
          className="min-h-[480px] w-full rounded-lg border border-gray-200/80 bg-white shadow-sm"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  )
}

export function PlaybookPreviewModal({ preview, onClose, offsetForSlideover = false }) {
  if (!preview) return null

  const isEmail = preview.type === 'email'
  const displayValue = preview.label || preview.value || 'Selected component'
  const html = String(preview.html || '')
  const hasHtml = Boolean(html.trim())

  return (
    <section
      className={clsx(
        'fixed bottom-6 left-6 right-6 top-6 z-[60] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl',
        offsetForSlideover && 'lg:right-[500px]'
      )}
    >
      <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-200 px-5 py-4">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: isEmail ? '#DBEAFE' : '#D1FAE5', color: isEmail ? '#1D4ED8' : '#065F46' }}
        >
          <i className={clsx('ti', isEmail ? 'ti-mail' : 'ti-world')} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-gray-900">{isEmail ? 'Preview email' : 'Preview landing page'}</h2>
          <p className="truncate text-xs text-gray-500">{displayValue}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close preview"
        >
          <i className="ti ti-x text-lg" />
        </button>
      </header>
      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-gray-100 p-6">
        {isEmail && hasHtml && (
          <ClientPreview
            html={html}
            sender={preview.sender || 'Pukat Simulation <notification@corp-sim.local>'}
            subject={preview.subject || displayValue}
            timestampLabel="Today, 10:24 AM"
            recipientLabel="{{.Email}} (Target Employee)"
          />
        )}
        {isEmail && !hasHtml && <EmailPreview value={displayValue} />}
        {!isEmail && hasHtml && <LandingHtmlPreview html={html} redirectUrl={preview.redirectUrl} />}
        {!isEmail && !hasHtml && <LandingPreview value={displayValue} />}
      </div>
    </section>
  )
}
