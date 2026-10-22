import { useState } from 'react'
import clsx from 'clsx'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import Button from '../../../components/UI/Button.jsx'
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

export default function Step3({ form, setForm, csvData, playbooks = [], componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS, onBack, onLaunch, onDraft, onRefreshChecklist, isLaunching, isSavingDraft, launchStage, isEditing = false, entity = '', canBypassEmailDomainGuardrail = false, educationFollowUpAvailable = false, quizFollowUpAvailable = false, quizPassScore = null }) {
  const reminderEnabled = form.followUp?.forceResetPasswordReminderEnabled ?? false
  // Education follow-up (G3b) is only offered when this entity has a published
  // education page synced to a GoPhish master; otherwise there's nothing to
  // chain to. The toggle defaults on, so its effective state folds in
  // availability — matching what the launch payload actually sends.
  const educationEnabled = educationFollowUpAvailable && (form.followUp?.educationEnabled ?? true)
  // Quiz follow-up is independent of education (PRD_QUIZ_MODULE FR-13): with
  // education off it chains the simulation straight to the quiz master. It
  // defaults on when available, like education, so the effective state folds
  // in availability to match the launch payload.
  const quizEnabled = quizFollowUpAvailable && (form.followUp?.quizEnabled ?? true)
  const quizPassScoreOverride = form.followUp?.quizPassScore ?? ''
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
  // The dynamic domain is optional, but once picked
  // PlaybookMasterService::readiness_errors() requires it to be active AND
  // authorized. Without this the checklist showed all green and the launch
  // failed late with a playbook-worded 422.
  const domainReady = optionReady(componentOptions.domain, customComponents.domain)

  // Recipient email-domain guardrail: targets must be on the entity's active
  // allow-list (My Profile > Guardrails). The backend enforces this at launch;
  // this mirrors it so the problem is visible before launching.
  const { data: entityDomains, isLoading: domainsLoading, refetch: refetchEntityDomains } = useEntityEmailDomains(entity)
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

  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshChecklist = async () => {
    setRefreshing(true)
    const [domainsResult, sourcesError] = await Promise.all([
      refetchEntityDomains(),
      onRefreshChecklist ? onRefreshChecklist() : null,
    ])
    setRefreshing(false)

    const error = domainsResult?.error || sourcesError
    if (error) {
      toast.error(error.message || 'Gagal memuat ulang pre-launch checklist.')
      return
    }

    toast.success('Pre-launch checklist refreshed.')
  }

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
        {
          ok: !customComponents.domain || domainReady,
          text: !customComponents.domain
            ? 'Dynamic domain — not set (optional)'
            : domainReady
              ? `Dynamic domain — ${domainLabel}`
              : `Dynamic domain — ${domainLabel} (not active or not authorized; clear it or fix the domain before launch)`,
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
      <div className="bg-panel border border-line rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-ink">Pre-launch checklist</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshChecklist}
            disabled={refreshing}
            title="Re-check playbook/component readiness, entity guardrails, and the education page"
          >
            <i className={clsx('ti ti-refresh text-sm', refreshing && 'animate-spin')} />
            <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
          </Button>
        </div>
        <div className="space-y-2">
          {checklist.map(({ ok, warn, neutral, label, text }, i) => (
            <div key={i} className={clsx(
              'rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between',
              ok ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                : warn ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20'
                  : neutral ? 'bg-panel-subtle text-ink-muted border border-line'
                  : 'bg-red-500/10 text-red-800 dark:text-red-300 border border-red-500/20',
            )}>
              <span>{ok ? '✓' : warn ? '⚠' : neutral ? '…' : '✗'} {text}</span>
              {label && <span className="ml-4 whitespace-nowrap rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold">{label}</span>}
            </div>
          ))}
          {/* Static warning */}
          <div className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between">
            <span>⚠ Pre-simulation announcement has not been sent to all targets</span>
            <Link to="/pre/socialization" className="underline font-semibold whitespace-nowrap ml-4">Send now</Link>
          </div>
        </div>
      </div>

      {/* Card 2 — Summary + Post-launch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Summary */}
        <div className="bg-panel border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Campaign summary</h3>
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
                <span className="text-xs text-ink-muted w-32 flex-shrink-0">{label}</span>
                <span className={clsx('text-xs font-bold text-right', red ? 'text-red-600 dark:text-red-400' : 'text-ink')}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* After running */}
        <div className="bg-panel border border-line rounded-xl p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Set The Follow Up</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <i className="ti ti-circle-check text-emerald-600 dark:text-emerald-400 text-base flex-shrink-0" />
              Monitoring real-time enabled automatically
            </div>

            {/* Education follow-up (G3b) — live when the entity has a published
                education page synced to GoPhish, otherwise gated off. */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 text-xs text-ink-soft">
                <i className={clsx('ti text-base flex-shrink-0', educationEnabled ? 'ti-circle-check text-emerald-600 dark:text-emerald-400' : 'ti-circle-x text-ink-faint')} />
                <span>
                  {educationFollowUpAvailable
                    ? (educationEnabled ? 'Education page shown after a user submits' : 'Education follow-up disabled for this campaign')
                    : 'Education follow-up unavailable'}
                  {!educationFollowUpAvailable && (
                    <span className="block text-[11px] text-ink-faint mt-0.5">
                      Publish this entity&apos;s Flag education page (My Profile → Flags) and sync it to GoPhish first.
                    </span>
                  )}
                </span>
              </div>
              <Switch
                checked={educationEnabled}
                onChange={value => setFollowUp({ educationEnabled: value })}
                disabled={!educationFollowUpAvailable}
              />
            </div>

            {/* Quiz follow-up (Quiz Module Q4) — live when the entity has a
                published quiz page synced to GoPhish. */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 text-xs text-ink-soft">
                <i className={clsx('ti text-base flex-shrink-0', quizEnabled ? 'ti-circle-check text-emerald-600 dark:text-emerald-400' : 'ti-circle-x text-ink-faint')} />
                <span>
                  {quizFollowUpAvailable
                    ? (quizEnabled
                      ? (educationEnabled ? 'Quiz shown after the education page' : 'Quiz shown after a user submits')
                      : 'Quiz disabled for this campaign')
                    : 'Quiz unavailable'}
                  {!quizFollowUpAvailable && (
                    <span className="block text-[11px] text-ink-faint mt-0.5">
                      Mark one quiz as the default follow-up (Post Simulation → Quiz), then publish and sync it to GoPhish first.
                    </span>
                  )}
                </span>
              </div>
              <Switch
                checked={quizEnabled}
                onChange={value => setFollowUp({ quizEnabled: value })}
                disabled={!quizFollowUpAvailable}
              />
            </div>

            {quizEnabled && (
              <div className="flex items-center justify-between gap-2 pl-6">
                <label className="text-xs text-ink-soft" htmlFor="quiz-pass-score">
                  Pass score for this campaign
                  <span className="block text-[11px] text-ink-faint mt-0.5">
                    Leave empty to use the entity default{quizPassScore != null ? ` (${quizPassScore}%)` : ''}.
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="quiz-pass-score"
                    type="number"
                    min="0"
                    max="100"
                    value={quizPassScoreOverride}
                    onChange={e => setFollowUp({ quizPassScore: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder={quizPassScore != null ? String(quizPassScore) : '70'}
                    className="w-16 rounded-lg border border-line bg-panel px-2 py-1 text-xs text-ink text-right"
                  />
                  <span className="text-xs text-ink-faint">%</span>
                </div>
              </div>
            )}

            <div className="space-y-3 opacity-60 pointer-events-none border-t border-line-soft pt-3" title="These follow-up settings are still in development — not available yet.">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-ink-soft">
                  <i className={clsx('ti text-base flex-shrink-0', reminderEnabled ? 'ti-circle-check text-emerald-600 dark:text-emerald-400' : 'ti-circle-x text-ink-faint')} />
                  {reminderEnabled ? 'Notify enabled Force Reset Password' : 'Notify disabled Force Reset Password'}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-panel-muted text-ink-muted">Coming soon</span>
                  <Switch checked={reminderEnabled} onChange={value => setFollowUp({ forceResetPasswordReminderEnabled: value })} disabled />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-line-soft">
        <button onClick={onBack} className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onDraft} disabled={isSavingDraft || isLaunching || sendTimeInvalid}
            title={sendTimeInvalid ? 'Fix the sending schedule — Send time must be at least 5 minutes from now.' : undefined}
            className="bg-panel border border-line text-ink-soft hover:bg-panel-subtle disabled:opacity-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
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
