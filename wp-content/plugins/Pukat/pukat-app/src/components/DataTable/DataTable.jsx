import clsx from 'clsx'
import Badge from '../UI/Badge.jsx'
import Checkbox from '../UI/Checkbox.jsx'
import DataTableActionCell from './DataTableActionCell.jsx'
import DataTableEmptyState from './DataTableEmptyState.jsx'
import DataTablePagination from './DataTablePagination.jsx'
import DataTableToolbar from './DataTableToolbar.jsx'
import { resolveCellContent } from './cellRenderers.js'
import { resolveBulkActions } from './actionRegistry.js'

function SkeletonRows({ columnCount, hasSelection }) {
  return Array.from({ length: 6 }, (_, rowIndex) => (
    <tr key={rowIndex}>
      {hasSelection && (
        <td className="w-10 p-4">
          <div className="h-3.5 w-3.5 animate-pulse rounded bg-gray-100" />
        </td>
      )}
      {Array.from({ length: columnCount }, (_, columnIndex) => (
        <td key={columnIndex} className="p-4">
          <div className="h-3 w-full max-w-[140px] animate-pulse rounded bg-gray-100" />
        </td>
      ))}
    </tr>
  ))
}

function CellContent({ column, row }) {
  const content = resolveCellContent(column, row)

  switch (content.renderer) {
    case 'text_with_subtext':
      return (
        <div className="min-w-0">
          <div className="truncate font-semibold text-gray-900">{content.primary}</div>
          {content.subtext && <div className="truncate text-[11px] text-gray-400">{content.subtext}</div>}
        </div>
      )
    case 'badge':
    case 'status_badge':
      return content.label ? <Badge tone={content.tone} className="text-[10px]">{content.label}</Badge> : null
    case 'link':
      return content.href ? (
        <a href={content.href} target="_blank" rel="noreferrer" className="truncate text-violet-600 underline-offset-2 hover:underline">
          {content.label || content.href}
        </a>
      ) : (
        <span className="text-gray-300">—</span>
      )
    default:
      return content.label ? <span>{content.label}</span> : <span className="text-gray-300">—</span>
  }
}

export default function DataTable({
  tableKey,
  schema = {},
  rows = [],
  meta = {},
  state = {},
  loading = false,
  refetching = false,
  error = null,
  selectedRowIds,
  onStateChange,
  onSelectionChange,
  onRowAction,
  onBulkAction,
}) {
  const columns = schema.columns || []
  const filterDefs = (schema.filters || []).filter(filter => filter.type === 'select')
  const bulkActions = resolveBulkActions(schema.bulk_actions)
  const hasSelection = Boolean(onSelectionChange)
  const selected = selectedRowIds instanceof Set ? selectedRowIds : new Set(selectedRowIds || [])
  const isFilterActive = Boolean(state.search) || Object.values(state.filters || {}).some(Boolean)
  const isForbidden = Boolean(error?.forbidden || error?.status === 403)
  const columnSpan = columns.length + (hasSelection ? 1 : 0)
  const pageIds = rows.map(row => row.id)
  const allOnPageSelected = hasSelection && pageIds.length > 0 && pageIds.every(id => selected.has(id))

  function updateState(patch) {
    onStateChange?.({ ...state, ...patch })
  }

  function handleSort(column) {
    if (!column.sortable) return
    const nextOrder = state.sort === column.key && state.order === 'asc' ? 'desc' : 'asc'
    updateState({ sort: column.key, order: nextOrder })
  }

  function toggleRow(rowId) {
    const next = new Set(selected)
    if (next.has(rowId)) next.delete(rowId)
    else next.add(rowId)
    onSelectionChange(next)
  }

  function toggleAllOnPage() {
    const next = new Set(selected)
    if (allOnPageSelected) pageIds.forEach(id => next.delete(id))
    else pageIds.forEach(id => next.add(id))
    onSelectionChange(next)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm" data-table-key={tableKey}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <DataTableToolbar
          search={state.search}
          filters={state.filters}
          filterDefs={filterDefs}
          searchPlaceholder={schema.search?.placeholder || 'Search...'}
          onSearchChange={search => updateState({ search, page: 1 })}
          onFilterChange={(key, value) => updateState({ filters: { ...(state.filters || {}), [key]: value }, page: 1 })}
        />
        {refetching && <i className="ti ti-refresh animate-spin text-sm text-gray-400" aria-label="Refreshing" />}
      </div>

      {hasSelection && selected.size > 0 && bulkActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 bg-violet-50/60 px-4 py-2.5 text-xs">
          <span className="font-semibold text-violet-700">{selected.size} selected</span>
          {bulkActions.map(action => (
            <button
              key={action.key}
              type="button"
              onClick={() => onBulkAction?.({ actionKey: action.key, rowIds: Array.from(selected) })}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1 font-semibold text-violet-700 transition-all hover:bg-violet-100"
            >
              <i className={clsx('ti text-xs', action.icon)} />
              {action.label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {hasSelection && (
                <th className="w-10 p-4">
                  <Checkbox checked={allOnPageSelected} onChange={toggleAllOnPage} aria-label="Select all rows on this page" />
                </th>
              )}
              {columns.map(column => (
                <th
                  key={column.key}
                  className={clsx('p-4', column.align === 'right' && 'text-right', column.sortable && 'cursor-pointer select-none')}
                  onClick={() => handleSort(column)}
                >
                  <span className="inline-flex items-center gap-1">
                    {column.label}
                    {column.sortable && state.sort === column.key && (
                      <i className={clsx('ti text-[10px]', state.order === 'asc' ? 'ti-arrow-up' : 'ti-arrow-down')} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && <SkeletonRows columnCount={columns.length} hasSelection={hasSelection} />}

            {!loading && error && (
              <tr>
                <td colSpan={columnSpan} className="p-0">
                  <DataTableEmptyState variant={isForbidden ? 'forbidden' : 'error'} description={error.message} />
                </td>
              </tr>
            )}

            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={columnSpan} className="p-0">
                  <DataTableEmptyState variant={isFilterActive ? 'no-results' : 'empty'} />
                </td>
              </tr>
            )}

            {!loading && !error && rows.map(row => (
              <tr key={row.id} className="transition-colors hover:bg-gray-50/70">
                {hasSelection && (
                  <td className="w-10 p-4">
                    <Checkbox checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select row ${row.id}`} />
                  </td>
                )}
                {columns.map(column => (
                  <td key={column.key} className={clsx('p-4', column.align === 'right' && 'text-right')}>
                    {column.renderer === 'actions' ? (
                      <DataTableActionCell row={row} actions={row.row_actions} onAction={onRowAction} />
                    ) : column.renderer === 'custom' && typeof column.render === 'function' ? (
                      column.render(row, column)
                    ) : (
                      <CellContent column={column} row={row} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DataTablePagination
        page={state.page || 1}
        perPage={state.perPage || meta.per_page || 25}
        total={meta.total}
        hasNext={meta.has_next}
        onPageChange={nextPage => nextPage >= 1 && updateState({ page: nextPage })}
        onPerPageChange={nextPerPage => updateState({ perPage: nextPerPage, page: 1 })}
      />
    </div>
  )
}
