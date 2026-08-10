import clsx from 'clsx'
import { useState } from 'react'
import { useCsvUpload } from '../../../hooks/useCsvUpload.js'
import Modal from '../../../components/UI/Modal.jsx'
import AlertConfirmation from '../../../components/UI/AlertConfirmation.jsx'
import TargetForm from './TargetForm.jsx'
import TargetsTable from './TargetsTable.jsx'

function downloadTemplateCsv() {
  const csv = 'first_name,last_name,email,position,department\nJane,Doe,jane.doe@example.com,Analyst,Finance\n'
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
  const [editingIndex, setEditingIndex] = useState(null)
  const [deletingIndex, setDeletingIndex] = useState(null)

  function handleAddTarget(target) {
    setCsvData(prev => [...prev, target])
  }

  function handleEditSubmit(target) {
    setCsvData(prev => prev.map((row, i) => (i === editingIndex ? target : row)))
    setEditingIndex(null)
  }

  function handleDeleteConfirm() {
    setCsvData(prev => prev.filter((_, i) => i !== deletingIndex))
    setDeletingIndex(null)
  }

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

      {/* Card 2 — Import targets */}
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
          <span className="text-[10px] text-gray-400">Columns: first_name, last_name, email, position, department</span>
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
          {csvData.length > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
              <i className="ti ti-circle-check" />
              <span>{csvData.length.toLocaleString('en-US')} targets imported successfully</span>
            </span>
          )}
        </div>

        {/* Add target manually */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
          <h4 className="text-xs font-semibold text-gray-700 mb-3">Add target manually</h4>
          <TargetForm onSubmit={handleAddTarget} />
        </div>

        {/* Preview table */}
        <TargetsTable
          rows={csvData}
          onEdit={setEditingIndex}
          onDelete={setDeletingIndex}
        />
      </div>

      {editingIndex !== null && (
        <Modal title="Edit target" onClose={() => setEditingIndex(null)}>
          <TargetForm
            initialValues={csvData[editingIndex]}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingIndex(null)}
            submitLabel="Save changes"
          />
        </Modal>
      )}

      {deletingIndex !== null && (
        <AlertConfirmation
          title="Delete target"
          message={`Remove ${csvData[deletingIndex]?.email || 'this target'} from the target list?`}
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingIndex(null)}
        />
      )}

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
