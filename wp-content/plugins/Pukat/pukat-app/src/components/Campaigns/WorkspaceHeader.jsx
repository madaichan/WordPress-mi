import toast from 'react-hot-toast'

export default function WorkspaceHeader({ total, activeCount, completedCount, onNew }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {total} total campaigns · {activeCount} running · {completedCount} completed
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => toast.success('Campaign workspace export is being prepared.')}
          className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all"
        >
          Export
        </button>
        <button
          onClick={onNew}
          className="bg-violet-500 text-white hover:bg-violet-600 px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all"
        >
          <i className="ti ti-circle-plus text-base" />
          <span>New campaign</span>
        </button>
      </div>
    </div>
  )
}
