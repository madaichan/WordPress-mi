import clsx from 'clsx'

export default function PlanningReportPane({ onNew }) {
  const historical = [28, 19, 22, 15, 18, 12]
  const max = Math.max(...historical)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <i className="ti ti-sparkles text-lg animate-pulse" />
          <h3 className="text-base font-semibold text-gray-900">Recommended next scenarios</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            ['Q3 — Finance Deep Dive', 'Focus on Finance, which still has a click rate 52%. Use a more complex wire-fraud scenario.', 'Recommendation', 'border-2 border-violet-500 bg-violet-50/5'],
            ['Q3 — Org-wide Awareness', 'A light simulation for the whole organization. Focus on raising the awareness baseline across all departments.', 'Credential', 'border border-gray-200 bg-white'],
            ['Q3 — Vishing + Smishing', 'Add a new dimension: phishing simulations by phone and SMS.', 'Vishing', 'border border-gray-200 bg-white'],
          ].map(([title, desc, badge, cls]) => (
            <button key={title} onClick={onNew} className={clsx('rounded-xl p-4 flex flex-col justify-between h-44 text-left', cls)}>
              <div>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h4 className="text-xs font-bold text-gray-900">{title}</h4>
                  <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700">{badge}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-red-100 text-red-700">BEC</span>
                <span className="rounded-full text-[9px] font-semibold px-2 py-0.5 bg-gray-100 text-gray-600">Difficulty 5</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-3 space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Tren click rate historis</h3>
          <div className="pt-4">
            <div className="flex items-end gap-2 h-20 select-none">
              {historical.map((value, index) => (
                <div key={`${value}-${index}`} className={clsx('flex-1 rounded-t', index === 4 ? 'bg-violet-500' : index === 5 ? 'bg-emerald-500' : 'bg-gray-300')} style={{ height: `${(value / max) * 100}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 font-semibold mt-2 px-1">
              {["Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", 'Target Q3'].map(label => (
                <span key={label} className={label === "Q2'25" ? 'text-violet-500 font-bold' : undefined}>{label}</span>
              ))}
            </div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2.5 text-xs text-emerald-800 flex items-start gap-2 mt-3 select-none">
            <i className="ti ti-shield-check text-base text-emerald-600 flex-shrink-0" />
            <span>Q3 targets: click rate down to &lt;12% with harder scenarios</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Simulation calendar</h3>
            <button onClick={onNew} className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all">
              Create campaign
            </button>
          </div>
          {[
            ['Q2 Phishing Wave', '28 Jun – 5 Jul 2025 · Completed', 'Completed', 'bg-emerald-500', 'bg-emerald-100 text-emerald-700'],
            ['Q3 — Finance Deep Dive', 'Draft · Audience: Sep 2025', 'Draft', 'bg-violet-500', 'bg-violet-100 text-violet-700'],
          ].map(([title, meta, badge, dot, badgeCls]) => (
            <div key={title} className="bg-gray-50 rounded-lg p-3 text-xs flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className={clsx('w-2 h-2 rounded-full mt-1 flex-shrink-0', dot)} />
                <div>
                  <h4 className="font-semibold text-gray-900">{title}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">{meta}</p>
                </div>
              </div>
              <span className={clsx('rounded-full text-[9px] font-semibold px-2 py-0.5', badgeCls)}>{badge}</span>
            </div>
          ))}
          <button onClick={onNew} className="w-full border border-dashed border-gray-200 rounded-lg p-3 text-xs flex items-center justify-center gap-1.5 cursor-pointer text-gray-400 hover:text-gray-600 hover:border-gray-300 select-none">
            <i className="ti ti-plus text-base" />
            <span className="font-semibold">Add Q4 2025 simulation</span>
          </button>
        </div>
      </div>
    </div>
  )
}
