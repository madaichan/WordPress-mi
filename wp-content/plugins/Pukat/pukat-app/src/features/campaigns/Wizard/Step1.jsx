import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useCsvUpload } from '../../../hooks/useCsvUpload.js'
import { TEMPLATES, TEMPLATE_FILTERS, DEMO_TARGET_TOTAL, DEMO_TARGETS } from './wizardData.js'

function openGophishTemplates() {
  const gophishUrl = window.PukatData?.gophishUrl

  if (!gophishUrl) {
    toast('Configure GoPhish URL in Settings first.')
    return
  }

  window.open(`${gophishUrl.replace(/\/$/, '')}/templates`, '_blank', 'noopener,noreferrer')
}

function downloadTemplateCsv() {
  const csv = 'name,email,department,position\nJane Doe,jane.doe@example.com,Finance,Analyst\n'
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')

  link.href = url
  link.download = 'pukat-target-template.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function Step1({ form, setForm, csvData, setCsvData, onCancel, onNext }) {
  const { getRootProps, getInputProps, isDragActive } = useCsvUpload({
    csvData,
    setCsvData,
    invalidRowMessage: (row, index) => `Row ${index + 2}: invalid email`,
    successMessage: (validCount, errorCount) =>
      `${validCount} targets loaded successfully.${errorCount ? ` (${errorCount} skipped)` : ''}`,
    parseErrorMessage: (err) => `Failed to read CSV: ${err.message}`,
  })

  const filteredTemplates = form.templateFilter === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.type.toLowerCase().includes(form.templateFilter.toLowerCase()))

  return (
    <div className="space-y-6">
      {/* Card 1 — Informasi campaign */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Informasi campaign</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Campaign name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Q2 Phishing Wave — Finance"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">Description</label>
            <input
              type="text"
              value={form.desc}
              onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
              placeholder="Optional"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>
      </div>

      {/* Card 2 — Select phishing template */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Select phishing template</h3>
          <span className="rounded-full text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700">gophish</span>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {TEMPLATE_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setForm(fr => ({ ...fr, templateFilter: f }))}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                form.templateFilter === f ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {filteredTemplates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setForm(f => ({ ...f, template: t.id }))}
              aria-pressed={form.template === t.id}
              className={clsx(
                'rounded-xl p-4 flex flex-col justify-between h-36 cursor-pointer select-none text-left transition-all',
                form.template === t.id
                  ? 'border-2 border-violet-500 bg-violet-50/20'
                  : 'border border-gray-200 hover:border-gray-300',
              )}
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">
                  <i className={clsx('ti text-lg', t.icon)} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-900">{t.name}</h4>
                  <span className="text-[10px] text-gray-500">{t.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className={clsx('w-1.5 h-1.5 rounded-full', t.dot)} />
                <span className="text-[10px] font-medium text-gray-500">{t.diffText}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openGophishTemplates}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-600"
        >
          <i className="ti ti-external-link" />
          <span>Create a new template in GoPhish</span>
        </button>
      </div>

      {/* Card 3 — Import targets */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Import targets</h3>

        <div
          {...getRootProps()}
          className={clsx(
            'border-2 border-dashed rounded-xl p-7 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all',
            isDragActive ? 'border-violet-500 bg-violet-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50/50',
          )}
        >
          <input {...getInputProps()} />
          <i className="ti ti-upload text-3xl text-gray-300" />
          <span className="text-xs font-semibold text-gray-700">Upload CSV file</span>
          <span className="text-[10px] text-gray-400">Columns: name, email, department, position</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={downloadTemplateCsv}
            className="inline-flex items-center gap-1 font-semibold text-violet-500 hover:text-violet-600"
          >
            <i className="ti ti-download" />
            <span>Download template CSV</span>
          </button>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <i className="ti ti-circle-check" />
            <span>{(csvData.length || DEMO_TARGET_TOTAL).toLocaleString('en-US')} targets imported successfully</span>
          </span>
        </div>

        {/* Preview table */}
        {csvData.length > 0 ? (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Email</th>
                  <th className="py-2 px-4">Department</th>
                  <th className="py-2 px-4">Position</th>
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 2).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 px-4 font-semibold text-gray-900">{r.first_name || r.firstname || ''} {r.last_name || r.lastname || ''}</td>
                    <td className="py-2 px-4">{r.email}</td>
                    <td className="py-2 px-4">{r.department || '—'}</td>
                    <td className="py-2 px-4">{r.position || '—'}</td>
                  </tr>
                ))}
                {csvData.length > 2 && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={4} className="py-2 px-4 italic text-gray-400 text-center">
                      + {(csvData.length - 2).toLocaleString('en-US')} more targets
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Static demo table */
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px] text-gray-700">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Email</th>
                  <th className="py-2 px-4">Department</th>
                  <th className="py-2 px-4">Position</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-4 font-semibold text-gray-900">Budi Santoso</td>
                  <td className="py-2 px-4">budi.santoso@company.id</td>
                  <td className="py-2 px-4">Finance</td>
                  <td className="py-2 px-4">Finance manager</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 px-4 font-semibold text-gray-900">Sari Dewi</td>
                  <td className="py-2 px-4">sari.dewi@company.id</td>
                  <td className="py-2 px-4">HR</td>
                  <td className="py-2 px-4">HR generalist</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td colSpan={4} className="py-2 px-4 italic text-gray-400 text-center">+ {(DEMO_TARGET_TOTAL - DEMO_TARGETS.length).toLocaleString('en-US')} more targets</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button onClick={onCancel} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
          Cancel
        </button>
        <button onClick={onNext} className="bg-violet-500 text-white hover:bg-violet-600 px-5 py-2 text-sm font-semibold rounded-xl transition-all">
          Continue to performing →
        </button>
      </div>
    </div>
  )
}
