import clsx from 'clsx'

export default function Step2({ form, setForm, playbooks = [], playbooksLoading = false, onBack, onNext }) {
  const canContinue = form.mode !== 'playbook' || Boolean(form.playbook)

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
            disabled
            aria-disabled="true"
            title="Custom campaign is coming soon — not available yet."
            className="rounded-xl p-4 text-left transition-all border border-gray-200 opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">Custom campaign</h4>
              <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-500">Coming soon</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">Configure the email template, landing page, and SMTP relay manually.</p>
          </button>
        </div>
      </div>

      {/* Card 2 — Select playbook */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Select playbook</h3>
          <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">gophish</span>
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

        {!playbooksLoading && playbooks.length > 0 && (
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
      </div>

      {/* Card 3 — Sending schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Sending schedule</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Start date *</label>
            <input type="date" value={form.dateStart} onChange={e => setForm(f => ({ ...f, dateStart: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">End date *</label>
            <input type="date" value={form.dateEnd} onChange={e => setForm(f => ({ ...f, dateEnd: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Timezone</label>
            <select value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500">
              <option value="WIB">WIB (Asia/Jakarta)</option>
              <option value="WITA">WITA (Asia/Makassar)</option>
              <option value="WIT">WIT (Asia/Jayapura)</option>
            </select>
          </div>
        </div>
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
