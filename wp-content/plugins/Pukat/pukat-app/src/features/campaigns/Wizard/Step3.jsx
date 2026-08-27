import clsx from 'clsx'
import { Link } from 'react-router-dom'
import Switch from '../../../components/UI/Switch.jsx'
import { DEMO_TARGET_TOTAL } from './wizardData.js'

const LAUNCH_STAGE_LABELS = {
  creating: 'Creating run…',
  'importing-targets': 'Importing targets…',
  launching: 'Launching…',
}

export default function Step3({ form, setForm, csvData, playbooks = [], onBack, onLaunch, onDraft, isLaunching, launchStage }) {
  const quizEnabled = form.followUp?.quizEnabled ?? true
  const reminderEnabled = form.followUp?.forceResetPasswordReminderEnabled ?? false

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

  const checklist = [
    {
      ok: csvData.length > 0,
      text: csvData.length > 0
        ? `${csvData.length.toLocaleString('en-US')} targets imported successfully`
        : 'Import targets before launching',
    },
    { ok: Boolean(selectedPlaybook) && selectedPlaybookReady, text: playbookChecklistText },
    { ok: Boolean(readiness?.ready), text: componentsReadyText },
    { ok: !!(form.dateStart && form.dateEnd), text: form.dateStart && form.dateEnd ? `Schedule set — ${form.dateStart} to ${form.dateEnd} at ${form.sendTime || '09:00'} (${form.timezone})` : 'Set sending schedule' },
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
          {checklist.map(({ ok, text }, i) => (
            <div key={i} className={clsx(
              'rounded-lg px-4 py-2.5 text-xs font-medium flex items-center justify-between',
              ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100',
            )}>
              <span>{ok ? '✓' : '✗'} {text}</span>
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
              { label: 'Playbook', value: selectedPlaybook?.name || '—' },
              { label: 'Total targets', value: `${targetCount.toLocaleString('en-US')} user` },
              {
                label: 'Sending schedule',
                value: form.dateStart && form.dateEnd
                  ? `${formatDate(form.dateStart)} – ${formatDate(form.dateEnd)}, ${form.sendTime || '09:00'} (${form.timezone || 'WIB'})`
                  : '—',
              },
              { label: 'Difficulty', value: selectedPlaybook?.diff ? `${selectedPlaybook.diff}/5 (NIST)` : '—', red: true },
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
          <button onClick={onDraft} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Save as draft
          </button>
          <button onClick={onLaunch} disabled={isLaunching}
            className="bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all">
            <i className="ti ti-player-play-filled text-sm" />
            {isLaunching ? (LAUNCH_STAGE_LABELS[launchStage] || 'Launching...') : 'Launch campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}
