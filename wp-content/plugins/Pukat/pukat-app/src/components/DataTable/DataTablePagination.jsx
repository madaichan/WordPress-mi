import Select from '../UI/Select.jsx'

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

export default function DataTablePagination({ page, perPage, total, hasNext, onPageChange, onPerPageChange }) {
  const totalPages = typeof total === 'number' ? Math.max(1, Math.ceil(total / perPage)) : null
  const canGoPrev = page > 1
  const canGoNext = totalPages ? page < totalPages : Boolean(hasNext)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/40 px-4 py-3 text-xs">
      <div className="flex items-center gap-2 text-gray-500">
        <span>Rows per page</span>
        <Select value={perPage} onChange={event => onPerPageChange?.(Number(event.target.value))} className="w-auto py-1">
          {PER_PAGE_OPTIONS.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-3 text-gray-500">
        <span>
          {totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`}
          {typeof total === 'number' && ` · ${total} rows`}
        </span>
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={!canGoPrev}
            aria-label="Previous page"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ti ti-chevron-left text-xs" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={!canGoNext}
            aria-label="Next page"
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="ti ti-chevron-right text-xs" />
          </button>
        </div>
      </div>
    </div>
  )
}
