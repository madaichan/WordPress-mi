import { useMemo, useState } from 'react'
import clsx from 'clsx'
import Switch from '../../../components/UI/Switch.jsx'
import ViewToggle from '../../../components/UI/ViewToggle.jsx'
import { DataTable } from '../../../components/DataTable/index.js'
import { PlaybookComponentSelect } from '../../../components/playbooks/PlaybookFormControls.jsx'
import { EMPTY_PLAYBOOK_COMPONENT_OPTIONS } from '../../../utils/playbookComponentOptions.js'
import { paginateRows } from '../../../utils/clientTableState.js'
import { todayDateString, addDaysToDateString, minSendTimeForDate, isScheduleSendTimeInvalid } from '../../../utils/campaignLaunch.js'

const VIEW_MODE_OPTIONS = [
  { value: 'grid', icon: 'ti-layout-grid', label: 'Grid view' },
  { value: 'table', icon: 'ti-list', label: 'Table view' },
]

const PLAYBOOK_TABLE_DEFAULT_STATE = { search: '', sort: 'name', order: 'asc', page: 1, perPage: 10, filters: {} }

const PLAYBOOK_TYPE_TONES = { BEC: 'danger', Credential: 'warning', Malware: 'success', Vishing: 'violet' }
const PLAYBOOK_STATUS_TONES = { Active: 'success', Approved: 'info', Draft: 'warning', Archived: 'gray' }

export default function Step2({ form, setForm, playbooks = [], playbooksLoading = false, componentOptions = EMPTY_PLAYBOOK_COMPONENT_OPTIONS, canUseCustom = false, onBack, onNext }) {
  const scheduleEnabled = form.scheduleEnabled ?? true
  const customComponents = form.customComponents || {}
  const [playbookViewMode, setPlaybookViewMode] = useState('grid')
  const [playbookTableState, setPlaybookTableState] = useState(PLAYBOOK_TABLE_DEFAULT_STATE)

  function renderPlaybookSelectCell(row) {
    const selected = String(form.playbook) === String(row.id)
    return (
      <button
        type="button"
        onClick={() => setForm(f => ({ ...f, playbook: row.id }))}
        aria-pressed={selected}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
          selected ? 'bg-violet-500 text-white' : 'border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600',
        )}
      >
        {selected ? (<><i className="ti ti-check text-sm" /> Selected</>) : 'Select'}
      </button>
    )
  }

  const playbookColumns = [
    { key: 'name', label: 'Playbook', renderer: 'text_with_subtext', subtextKey: 'desc', sortable: true },
    { key: 'type', label: 'Type', renderer: 'badge', toneMap: PLAYBOOK_TYPE_TONES },
    { key: 'diff', label: 'Difficulty', renderer: 'text', sortable: true },
    { key: 'statusLabel', label: 'Status', renderer: 'badge', toneMap: PLAYBOOK_STATUS_TONES },
    { key: 'select', label: '', renderer: 'custom', align: 'right', render: renderPlaybookSelectCell },
  ]

  const { rows: playbookRows, total: playbookTotal } = useMemo(
    () => paginateRows(playbooks, playbookTableState, { searchFields: ['name', 'desc'] }),
    [playbooks, playbookTableState],
  )

  const today = todayDateString()
  const minDateEnd = addDaysToDateString(form.dateStart || today, 1)
  const minSendTime = minSendTimeForDate(form.dateStart)
  const sendTimeInvalid = isScheduleSendTimeInvalid(form)
  const canContinue = !sendTimeInvalid && (
    form.mode === 'custom'
      ? Boolean(customComponents.email && customComponents.page && customComponents.smtp)
      : Boolean(form.playbook)
  )

  function setCustomComponent(field, value) {
    setForm(f => ({ ...f, customComponents: { ...f.customComponents, [field]: value } }))
  }

  function handleDateStartChange(value) {
    const clamped = value && value < today ? today : value
    setForm(f => {
      const minEnd = addDaysToDateString(clamped, 1)
      return {
        ...f,
        dateStart: clamped,
        dateEnd: f.dateEnd && f.dateEnd >= minEnd ? f.dateEnd : minEnd,
      }
    })
  }

  function handleDateEndChange(value) {
    const minEnd = addDaysToDateString(form.dateStart, 1)
    setForm(f => ({ ...f, dateEnd: value && value < minEnd ? minEnd : value }))
  }

  return (
    <div className="space-y-6">
      {/* Card 1 — Campaign mode */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Campaign mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, mode: 'playbook' }))}
            aria-pressed={form.mode === 'playbook'}
            className={clsx(
              'rounded-xl p-4 cursor-pointer select-none text-left transition-all',
              form.mode === 'playbook' ? 'border-2 border-violet-500 bg-violet-50/20' : 'border border-gray-200 hover:border-gray-300',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Use playbook</h4>
              <div className="flex gap-1.5">
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-violet-100 text-violet-700">Fast</span>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-700">Recommendation</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">Choose a ready-made simulation scenario and launch quickly.</p>
          </button>
          <button
            type="button"
            onClick={() => canUseCustom && setForm(f => ({ ...f, mode: 'custom' }))}
            disabled={!canUseCustom}
            aria-pressed={form.mode === 'custom'}
            aria-disabled={!canUseCustom}
            title={canUseCustom ? undefined : 'You need the "Create Playbook Master" permission to use Custom campaign.'}
            className={clsx(
              'rounded-xl p-4 text-left transition-all',
              !canUseCustom && 'border border-gray-200 opacity-60 cursor-not-allowed',
              canUseCustom && form.mode === 'custom' && 'border-2 border-violet-500 bg-violet-50/20 cursor-pointer select-none',
              canUseCustom && form.mode !== 'custom' && 'border border-gray-200 hover:border-gray-300 cursor-pointer select-none',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Custom campaign</h4>
              <span className={clsx(
                'rounded-full text-[9px] font-semibold px-2 py-0.5',
                canUseCustom ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500',
              )}>
                {canUseCustom ? 'Flexible' : 'Permission required'}
              </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">Configure the email template, landing page, and SMTP relay manually.</p>
          </button>
        </div>
      </div>

      {form.mode === 'custom' ? (
        /* Card 2 — Configure components (custom mode) */
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-900">Configure components</h3>
            <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">gophish</span>
          </div>
          <p className="text-xs text-gray-500 -mt-2 mb-2">
            Pick the technical components for this campaign directly — the same ones used when creating a Playbook Master.
          </p>
          <PlaybookComponentSelect
            icon="ti-mail"
            bg="#DBEAFE"
            color="#1D4ED8"
            label="Email template"
            value={customComponents.email}
            options={componentOptions.email}
            emptyLabel="Select an email template"
            onChange={value => setCustomComponent('email', value)}
          />
          <PlaybookComponentSelect
            icon="ti-world"
            bg="#D1FAE5"
            color="#065F46"
            label="Landing page"
            value={customComponents.page}
            options={componentOptions.page}
            emptyLabel="Select a landing page"
            onChange={value => setCustomComponent('page', value)}
          />
          <PlaybookComponentSelect
            icon="ti-send"
            bg="#FEF3C7"
            color="#92400E"
            label="SMTP profile"
            value={customComponents.smtp}
            options={componentOptions.smtp}
            emptyLabel="Select an SMTP profile"
            onChange={value => setCustomComponent('smtp', value)}
          />
          <PlaybookComponentSelect
            icon="ti-network"
            bg="#F3E8FF"
            color="#7C3AED"
            label="Dynamic domain"
            value={customComponents.domain}
            options={componentOptions.domain}
            emptyLabel="No dynamic domain (optional)"
            onChange={value => setCustomComponent('domain', value)}
          />
        </div>
      ) : (
        /* Card 2 — Select playbook */
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Select playbook</h3>
            <div className="flex items-center gap-2">
              {!playbooksLoading && playbooks.length > 0 && (
                <ViewToggle value={playbookViewMode} onChange={setPlaybookViewMode} options={VIEW_MODE_OPTIONS} />
              )}
              <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">gophish</span>
            </div>
          </div>
          {playbooksLoading && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs font-medium text-gray-500">
              Loading playbook masters...
            </div>
          )}

          {!playbooksLoading && playbooks.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-xs font-medium text-gray-500">
              No playbook masters found in database.
            </div>
          )}

          {!playbooksLoading && playbooks.length > 0 && playbookViewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playbooks.map(pb => (
                <button
                  key={pb.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, playbook: pb.id }))}
                  aria-pressed={String(form.playbook) === String(pb.id)}
                  className={clsx(
                    'rounded-xl p-4 cursor-pointer select-none text-left transition-all',
                    String(form.playbook) === String(pb.id) ? 'border-2 border-violet-500 bg-violet-50/20' : 'border border-gray-200 hover:border-gray-300',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-xs font-semibold text-gray-900">{pb.name}</h4>
                    {pb.statusLabel && (
                      <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold', pb.statusClass)}>
                        {pb.statusLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{pb.desc}</p>
                  <div className="flex items-center justify-between mt-3 text-[10px] font-semibold">
                    <span className={pb.typeColor}>{pb.type}</span>
                    <span className="text-gray-500">Difficulty {pb.diff}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!playbooksLoading && playbooks.length > 0 && playbookViewMode === 'table' && (
            <DataTable
              tableKey="wizard_playbooks"
              schema={{ columns: playbookColumns, search: { placeholder: 'Search playbooks...' } }}
              rows={playbookRows}
              meta={{ total: playbookTotal, per_page: playbookTableState.perPage }}
              state={playbookTableState}
              onStateChange={setPlaybookTableState}
            />
          )}
        </div>
      )}

      {/* Card 3 — Sending schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Sending schedule</h3>
          <Switch
            checked={scheduleEnabled}
            onChange={value => setForm(f => ({ ...f, scheduleEnabled: value }))}
            label={scheduleEnabled ? 'Scheduled' : 'Send immediately'}
          />
        </div>
        <div className={clsx('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', !scheduleEnabled && 'opacity-50')}>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Start date {scheduleEnabled && '*'}</label>
            <input type="date" disabled={!scheduleEnabled} min={today} value={form.dateStart} onChange={e => handleDateStartChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Send time {scheduleEnabled && '*'}</label>
            <input
              type="time"
              disabled={!scheduleEnabled}
              min={minSendTime || undefined}
              value={form.sendTime || '09:00'}
              onChange={e => setForm(f => ({ ...f, sendTime: e.target.value }))}
              className={clsx(
                'w-full bg-white border rounded-xl px-4 py-2 text-sm focus:outline-none disabled:bg-gray-50 disabled:cursor-not-allowed',
                sendTimeInvalid ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-violet-500',
              )}
            />
            {sendTimeInvalid && (
              <p className="text-[10px] font-medium text-red-500">Send time must be at least 5 minutes from now.</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">End date {scheduleEnabled && '*'}</label>
            <input type="date" disabled={!scheduleEnabled} min={minDateEnd} value={form.dateEnd} onChange={e => handleDateEndChange(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 disabled:bg-gray-50 disabled:cursor-not-allowed" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Timezone</label>
            <select disabled={!scheduleEnabled} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500 disabled:bg-gray-50 disabled:cursor-not-allowed">
              <option value="WIB">WIB (Asia/Jakarta)</option>
              <option value="WITA">WITA (Asia/Makassar)</option>
              <option value="WIT">WIT (Asia/Jayapura)</option>
            </select>
          </div>
        </div>
        <p className="text-[10px] text-gray-500">
          {scheduleEnabled
            ? 'Campaign emails start sending at this time on the start date, in the selected timezone.'
            : 'Sending schedule is off — the campaign will start sending immediately once launched.'}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button type="button" onClick={onBack} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="bg-violet-500 text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 px-5 py-2 text-sm font-semibold rounded-xl transition-all"
        >
          Continue to review →
        </button>
      </div>
    </div>
  )
}
