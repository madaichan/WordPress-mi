import { useState } from 'react'
import Table from '../../../components/UI/Table.jsx'
import TableActionButton from '../../../components/UI/TableActionButton.jsx'
import EmptyState from '../../../components/UI/EmptyState.jsx'
import DataTablePagination from '../../../components/DataTable/DataTablePagination.jsx'

export default function TargetsTable({ rows, onEdit, onDelete, pageSize: initialPageSize = 10 }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="ti-users"
        title="No targets yet"
        description="Import a CSV or add a target manually to get started."
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pageRows = rows.slice(start, start + pageSize)

  function handlePerPageChange(nextPageSize) {
    setPageSize(nextPageSize)
    setPage(1)
  }

  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <Table className="w-full text-left text-[11px] text-ink-soft" wrapperClassName="overflow-x-auto">
        <thead>
          <tr className="bg-panel-subtle border-b border-line text-[10px] font-bold text-ink-muted uppercase tracking-wider">
            <th className="py-2 px-4">First name</th>
            <th className="py-2 px-4">Last name</th>
            <th className="py-2 px-4">Email</th>
            <th className="py-2 px-4">Position</th>
            <th className="py-2 px-4">Department</th>
            <th className="py-2 px-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const index = start + i
            return (
              <tr key={index} className="border-b border-line-soft">
                <td className="py-2 px-4 font-semibold text-ink">{row.first_name || row.firstname || ''}</td>
                <td className="py-2 px-4">{row.last_name || row.lastname || ''}</td>
                <td className="py-2 px-4">{row.email}</td>
                <td className="py-2 px-4">{row.position || '—'}</td>
                <td className="py-2 px-4">{row.department || '—'}</td>
                <td className="py-2 px-4">
                  <div className="inline-flex items-center justify-end gap-1.5 w-full">
                    <TableActionButton icon="ti-pencil" label={`Edit ${row.email || ''}`} tone="violet" onClick={() => onEdit?.(index)} />
                    <TableActionButton icon="ti-trash" label={`Delete ${row.email || ''}`} tone="red" onClick={() => onDelete?.(index)} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      <DataTablePagination
        page={currentPage}
        perPage={pageSize}
        total={rows.length}
        hasNext={currentPage < totalPages}
        onPageChange={setPage}
        onPerPageChange={handlePerPageChange}
      />
    </div>
  )
}
