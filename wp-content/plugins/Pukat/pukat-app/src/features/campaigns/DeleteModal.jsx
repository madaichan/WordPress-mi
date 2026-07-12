export default function DeleteModal({ campaign, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <i className="ti ti-trash text-red-600 text-lg" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Delete campaign?</h3>
            <p className="text-xs text-gray-500 mt-1">
              <strong className="text-gray-700">{campaign.name}</strong> will be permanently deleted.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending}
            className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 px-4 py-2 text-sm font-semibold rounded-xl transition-all">
            {isPending ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
