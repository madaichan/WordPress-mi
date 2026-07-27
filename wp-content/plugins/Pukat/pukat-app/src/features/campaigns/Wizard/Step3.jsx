import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { TEMPLATES, DEMO_TARGET_TOTAL } from './wizardData.js'

export default function Step3({ form, csvData, playbooks = [], onBack, onLaunch, onDraft, isLaunching }) {
  const selectedPlaybook = playbooks.find(p => String(p.id) === String(form.playbook))
  const selectedPlaybookReady = String(selectedPlaybook?.status || '').toLowerCase() === 'active'
  const playbookChecklistText = selectedPlaybook
    ? selectedPlaybookReady
      ? `Selected playbook — ${selectedPlaybook.name} (${selectedPlaybook.type}, difficulty ${selectedPlaybook.diff})`
      : `Selected playbook — ${selectedPlaybook.name} (${selectedPlaybook.statusLabel || 'not active'}; activate before launch)`
    : 'Select Playbook Master'
  const selectedTemplate = TEMPLATES.find(t => t.id === form.template)
  const targetCount = csvData.length || DEMO_TARGET_TOTAL

  const checklist = [
    { ok: true, text: `${targetCount.toLocaleString('en-US')} targets imported successfully` },
    {
      ok: form.mode === 'playbook' ? Boolean(selectedPlaybook) && selectedPlaybookReady : Boolean(form.template),
      text: form.mode === 'playbook'
        ? playbookChecklistText
        : form.template ? `Selected email template — ${selectedTemplate?.name} (${selectedTemplate?.type}, difficulty ${selectedTemplate?.diff})` : 'Select phishing template',
    },
    { ok: true, text: 'SMTP sending profile validated' },
    { ok: true, text: 'Landing page configured in GoPhish' },
    { ok: !!(form.dateStart && form.dateEnd), text: form.dateStart && form.dateEnd ? `Schedule set — ${form.dateStart} to ${form.dateEnd} (${form.timezone})` : 'Set sending schedule' },
    { ok: true, text: 'No active blackout period' },
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
              { label: 'Duration', value: form.dateStart && form.dateEnd ? `${formatDate(form.dateStart)} – ${formatDate(form.dateEnd)}` : '—' },
              { label: 'Difficulty', value: selectedPlaybook?.diff ? `${selectedPlaybook.diff}/5 (NIST)` : selectedTemplate?.diff ? `${selectedTemplate.diff}/5 (NIST)` : '—', red: true },
            ].map(({ label, value, red }) => (
              <div key={label} className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500 w-28 flex-shrink-0">{label}</span>
                <span className={clsx('text-xs font-bold text-right', red ? 'text-red-600' : 'text-gray-900')}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* After running */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">After the campaign starts</h3>
          <div className="space-y-3">
            {[
              'Monitoring real-time enabled automatically',
              'Quiz sent to users who click',
              'Report generated automatically when complete',
              'Coaching sent to high-risk users',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-xs text-gray-700">
                <i className="ti ti-circle-check text-emerald-600 text-base flex-shrink-0" />
                {item}
              </div>
            ))}
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
            {isLaunching ? 'Launching...' : 'Launch campaign'}
          </button>
        </div>
      </div>
    </div>
  )
}
