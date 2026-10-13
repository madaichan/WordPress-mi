import clsx from 'clsx'
import { Link } from 'react-router-dom'
import Switch from '../../../components/UI/Switch.jsx'
import { DEMO_TARGET_TOTAL } from './wizardData.js'
import { isScheduleSendTimeInvalid } from '../../../utils/campaignLaunch.js'
import { useEntityEmailDomains, useEntityReadiness } from '../../../hooks/queries/useEntityQueries.js'
import { EMPTY_PLAYBOOK_COMPONENT_OPTIONS, optionLabel, optionReady } from '../../../utils/playbookComponentOptions.js'

const LAUNCH_STAGE_LABELS = {
  creating: 'Creating run…',
  'importing-targets': 'Importing targets…',
  launching: 'Launching…',
}

export default function Step3({ form, setForm, csvData, playbooks = [], componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS, onBack, onLaunch, onDraft, isLaunching, isSavingDraft, launchStage, isEditing = false, entity = '', canBypassEmailDomainGuardrail = false }) {
  const quizEnabled = form.followUp?.quizEnabled ?? true
  const reminderEnabled = form.followUp?.forceResetPasswordReminderEnabled ?? false
  const isCustomMode = form.mode === 'custom'
  const customComponents = form.customComponents || {}

  const setFollowUp = (patch) => setForm(f => ({ ...f, followUp: { ...f.followUp, ...patch } }))
  const selectedPlaybook = playbooks.find(p => String(p.id) === String(form.playbook))
  const selectedPlaybookReady = String(selectedPlaybook?.status || '').toLowerCase() === 'active'
  const playbookChecklistText = selectedPlaybook
    ? selectedPlaybookReady
      ? `Selected playbook — ${selectedPlaybook.name} (${selectedPlaybook.type}, difficulty ${selectedPlaybook.diff})`
      : `Selected playbook — ${selectedPlaybook.name} (${selectedPlaybook.statusLabel || 'not active'}; activate before launch)`
    : 'Select Playbook Master'
  const targetCount = csvData.length || DEMO_TARGET_TOTAL

  const readiness = selectedPlaybook?.readiness
  const componentsReadyText = selectedPlaybook
    ? readiness?.ready
      ? 'Email template, landing page, and sending profile are ready for launch'
      : (readiness?.errors || []).join('; ') || 'Playbook components are not ready for launch'
    : 'Select a Playbook Master to check component readiness'

  const emailLabel = optionLabel(componentOptions.email, customComponents.email)
  const landingLabel = optionLabel(componentOptions.page, customComponents.page)
  const smtpLabel = optionLabel(componentOptions.smtp, customComponents.smtp)
  const domainLabel = customComponents.domain ? optionLabel(componentOptions.domain, customComponents.domain) : 'Not set (optional)'

  // Picking a component isn't enough on its own — CampaignRunService/
  // PlaybookMasterService only accept an approved/active email & landing
  // version and an active, GoPhish-mapped SMTP profile. Surface that here so
  // the checklist doesn't show green for a draft component that will still
  // be rejected at launch.
  const emailReady = optionReady(componentOptions.email, customComponents.email)
  const landingReady = optionReady(componentOptions.page, customComponents.page)
  const smtpReady = optionReady(componentOptions.smtp, customComponents.smtp)

  // Recipient email-domain guardrail: targets must be on the entity's active
  // allow-list (My Profile > Guardrails). The backend enforces this at launch;
  // this mirrors it so the problem is visible before launching.
  const { data: entityDomains, isLoading: domainsLoading } = useEntityEmailDomains(entity)
  const { data: entityReadiness } = useEntityReadiness(entity)
  const domainGuardrailRequired = entityReadiness?.email_domain_required !== false
  const allowedDomains = (entityDomains || []).filter(d => d.status === 'active').map(d => String(d.domain).toLowerCase())
  const domainGuardrailLoaded = Boolean(entity) && !domainsLoading && entityDomains !== undefined
  const blockedEmails = domainGuardrailLoaded && allowedDomains.length > 0
    ? csvData
      .map(row => String(row.email || '').trim())
      .filter(email => email.includes('@') && !allowedDomains.includes(email.slice(email.lastIndexOf('@') + 1).toLowerCase()))
    : []
  const noActiveDomains = domainGuardrailLoaded && allowedDomains.length === 0 && domainGuardrailRequired
  const domainBlocked = noActiveDomains || (blockedEmails.length > 0 && !canBypassEmailDomainGuardrail)

  // status: passed | failed | bypass | disabled | checking | waiting
  let domainChecklistItem
  if (!csvData.length) {
    domainChecklistItem = { status: 'waiting', text: 'Email domain check — waiting for targets to be imported' }
  } else if (!domainGuardrailLoaded) {
    domainChecklistItem = { status: 'checking', text: `Email domain check — checking against "${entity}" guardrails…` }
  } else if (noActiveDomains) {
    domainChecklistItem = { status: 'failed', text: `Entity "${entity}" has no active company email domain — add one in My Profile > Guardrails` }
  } else if (allowedDomains.length === 0) {
    domainChecklistItem = { status: 'disabled', text: 'Email domain guardrail is disabled for this entity (no active domain)' }
  } else if (blockedEmails.length > 0) {
    const sample = blockedEmails.slice(0, 3).join(', ')
    const more = blockedEmails.length > 3 ? ` +${blockedEmails.length - 3} more` : ''
    domainChecklistItem = {
      status: canBypassEmailDomainGuardrail ? 'bypass' : 'failed',
      text: `${blockedEmails.length.toLocaleString('en-US')} target(s) use a domain not registered in "${entity}" guardrails (${sample}${more})${canBypassEmailDomainGuardrail ? ' — you can launch with bypass' : ' — remove them before launching'}`,
    }
  } else {
    domainChecklistItem = { status: 'passed', text: `All targets use registered email domains — ${allowedDomains.join(', ')}` }
  }
  const DOMAIN_STATUS = {
    passed:   { ok: true,  label: 'Passed' },
    disabled: { ok: true,  label: 'Skipped' },
    failed:   { ok: false, label: 'Blocked' },
    bypass:   { ok: false, warn: true, label: 'Bypass required' },
    checking: { ok: false, neutral: true, label: 'Checking…' },
    waiting:  { ok: false, neutral: true, label: 'Pending' },
  }[domainChecklistItem.status]
  domainChecklistItem = { ...DOMAIN_STATUS, text: domainChecklistItem.text }

  const scheduleEnabled = form.scheduleEnabled ?? true
  const sendTimeInvalid = isScheduleSendTimeInvalid(form)

  const checklist = [
    {
      ok: csvData.length > 0,
      text: csvData.length > 0
        ? `${csvData.length.toLocaleString('en-US')} targets imported successfully`
        : 'Import targets before launching',
    },
    ...(isCustomMode
      ? [
        {
          ok: Boolean(customComponents.email) && emailReady,
          text: !customComponents.email
            ? 'Select an email template'
            : emailReady
              ? `Email template — ${emailLabel}`
              : `Email template — ${emailLabel} (not approved yet; approve before launch)`,
        },
        {
          ok: Boolean(customComponents.page) && landingReady,
          text: !customComponents.page
            ? 'Select a landing page'
            : landingReady
              ? `Landing page — ${landingLabel}`
              : `Landing page — ${landingLabel} (not approved yet; approve before launch)`,
        },
        {
          ok: Boolean(customComponents.smtp) && smtpReady,
          text: !customComponents.smtp
            ? 'Select an SMTP profile'
            : smtpReady
              ? `SMTP profile — ${smtpLabel}`
              : `SMTP profile — ${smtpLabel} (not active or not mapped to GoPhish; fix before launch)`,
        },
      ]
      : [
        { ok: Boolean(selectedPlaybook) && selectedPlaybookReady, text: playbookChecklistText },
        { ok: Boolean(readiness?.ready), text: componentsReadyText },
      ]),
    scheduleEnabled
      ? sendTimeInvalid
        ? { ok: false, text: 'Send time must be at least 5 minutes from now' }
        : { ok: !!(form.dateStart && form.dateEnd), text: form.dateStart && form.dateEnd ? `Schedule set — ${form.dateStart} to ${form.dateEnd} at ${form.sendTime || '09:00'} (${form.timezone})` : 'Set sending schedule' }
      : { ok: true, text: 'Send immediately upon launch' },
    domainChecklistItem,
  ]

  const formatDate = (d) => {
    if (!d) return '—'
    const dt = new Date(d)
    return dt.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-6">
      {/* Card 1 — Pre-launch checklist */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Pre-launch checklist</h3>
        <div className="space-y-2">
          {checklist.map(({ ok, warn, neutral, label, text }, i) => (
            <div key={i} className={clsx(
              'rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between',
              ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                : warn ? 'bg-amber-50 text-amber-800 border border-amber-100'
                  : neutral ? 'bg-gray-50 text-gray-600 border border-gray-200'
                  : 'bg-red-50 text-red-800 border border-red-100',
            )}>
              <span>{ok ? '✓' : warn ? '⚠' : neutral ? '…' : '✗'} {text}</span>
              {label && <span className="ml-4 whitespace-nowrap rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">{label}</span>}
            </div>
          ))}
          {/* Static warning */}
          <div className="bg-amber-50 text-amber-800 border border-amber-100 rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between">
            <span>⚠ Pre-simulation announcement has not been sent to all targets</span>
            <Link to="/pre/socialization" className="underline font-semibold whitespace-nowrap ml-4">Send now</Link>
          </div>
        </div>
      </div>

      {/* Card 2 — Summary + Post-launch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign summary</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Name', value: form.name || '—' },
              ...(isCustomMode
                ? [
                  { label: 'Mode', value: 'Custom campaign' },
                  { label: 'Email template', value: emailLabel },
                  { label: 'Landing page', value: landingLabel },
                  { label: 'SMTP profile', value: smtpLabel },
                  { label: 'Dynamic domain', value: domainLabel },
                ]
                : [{ label: 'Playbook', value: selectedPlaybook?.name || '—' }]),
              { label: 'Total targets', value: `${targetCount.toLocaleString('en-US')} user` },
              {
                label: 'Sending schedule',
                value: !scheduleEnabled
                  ? 'Send immediately'
                  : form.dateStart && form.dateEnd
                    ? `${formatDate(form.dateStart)} – ${formatDate(form.dateEnd)}, ${form.sendTime || '09:00'} (${form.timezone || 'WIB'})`
                    : '—',
              },
              ...(isCustomMode ? [] : [{ label: 'Difficulty', value: selectedPlaybook?.diff ? `${selectedPlaybook.diff}/5 (NIST)` : '—', red: true }]),
            ].map(({ label, value, red }) => (
              <div key={label} className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500 w-32 flex-shrink-0">{label}</span>
                <span className={clsx('text-xs font-bold text-right', red ? 'text-red-600' : 'text-gray-900')}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* After running */}
        <div className="bg-white border border-gray-200 rounded-xl p-5" aria-disabled="true">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Set The Follow Up</h3>
            <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-500">Coming soon</span>
          </div>
          <div className="space-y-3 opacity-60 pointer-events-none" title="Follow-up settings are still in development — not available yet.">
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <i className="ti ti-circle-check text-emerald-600 text-base flex-shrink-0" />
              Monitoring real-time enabled automatically
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <i className={clsx('ti text-base flex-shrink-0', quizEnabled ? 'ti-circle-check text-emerald-600' : 'ti-circle-x text-gray-400')} />
                {quizEnabled ? 'Quiz sent to users who click' : 'Quiz disabled for this campaign'}
              </div>
              <Switch checked={quizEnabled} onChange={value => setFollowUp({ quizEnabled: value })} disabled />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <i className={clsx('ti text-base flex-shrink-0', reminderEnabled ? 'ti-circle-check text-emerald-600' : 'ti-circle-x text-gray-400')} />
                {reminderEnabled ? 'Notify enabled Force Reset Password' : 'Notify disabled Force Reset Password'}
              </div>
              <Switch checked={reminderEnabled} onChange={value => setFollowUp({ forceResetPasswordReminderEnabled: value })} disabled />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onBack} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onDraft} disabled={isSavingDraft || isLaunching || sendTimeInvalid}
            title={sendTimeInvalid ? 'Fix the sending schedule — Send time must be at least 5 minutes from now.' : undefined}
            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            {isSavingDraft ? 'Saving…' : isEditing ? 'Update draft' : 'Save as draft'}
          </button>
          <button onClick={onLaunch} disabled={isLaunching || isSavingDraft || sendTimeInvalid || domainBlocked}
            title={sendTimeInvalid ? 'Fix the sending schedule — Send time must be at least 5 minutes from now.' : domainBlocked ? 'Targets must use email domains registered in this entity\'s guardrails.' : undefined}
            className="bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all">
            <i className="ti ti-player-play-filled text-sm" />
            {isLaunching ? (LAUNCH_STAGE_LABELS[launchStage] || 'Launching...') : 'Launch campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}
