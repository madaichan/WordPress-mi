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
          <div className="h-3.5 w-3.5 animate-pulse rounded bg-panel-muted" />
        </td>
      )}
      {Array.from({ length: columnCount }, (_, columnIndex) => (
        <td key={columnIndex} className="p-4">
          <div className="h-3 w-full max-w-[140px] animate-pulse rounded bg-panel-muted" />
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
          <div className="truncate font-semibold text-ink">{content.primary}</div>
          {content.subtext && <div className="truncate text-[11px] text-ink-faint">{content.subtext}</div>}
        </div>
      )
    case 'badge':
    case 'status_badge':
      return content.label ? <Badge tone={content.tone} className="text-[10px]">{content.label}</Badge> : null
    case 'link':
      return content.href ? (
        <a href={content.href} target="_blank" rel="noreferrer" className="truncate text-violet-600 dark:text-violet-400 underline-offset-2 hover:underline">
          {content.label || content.href}
        </a>
      ) : (
        <span className="text-ink-faint">—</span>
      )
    default:
      return content.label ? <span>{content.label}</span> : <span className="text-ink-faint">—</span>
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
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm" data-table-key={tableKey}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft p-4">
        <DataTableToolbar
          search={state.search}
          filters={state.filters}
          filterDefs={filterDefs}
          searchPlaceholder={schema.search?.placeholder || 'Search...'}
          onSearchChange={search => updateState({ search, page: 1 })}
          onFilterChange={(key, value) => updateState({ filters: { ...(state.filters || {}), [key]: value }, page: 1 })}
        />
        {refetching && <i className="ti ti-refresh animate-spin text-sm text-ink-faint" aria-label="Refreshing" />}
      </div>

      {hasSelection && selected.size > 0 && bulkActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-violet-500/20 bg-violet-50/60 px-4 py-2.5 text-xs">
          <span className="font-semibold text-violet-700 dark:text-violet-300">{selected.size} selected</span>
          {bulkActions.map(action => (
            <button
              key={action.key}
              type="button"
              onClick={() => onBulkAction?.({ actionKey: action.key, rowIds: Array.from(selected) })}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-panel px-2.5 py-1 font-semibold text-violet-700 dark:text-violet-300 transition-all hover:bg-violet-500/15"
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
            <tr className="border-b border-line-soft bg-panel-subtle text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
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
          <tbody className="divide-y divide-line-soft">
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
              <tr key={row.id} className="transition-colors hover:bg-panel-subtle/70">
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
