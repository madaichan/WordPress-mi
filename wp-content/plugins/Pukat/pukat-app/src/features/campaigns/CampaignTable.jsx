import { DataTable } from '../../components/DataTable/index.js'

const TABLE_KEY = 'campaigns'

export default function CampaignTable({ schema, rows, meta, tableState, onTableStateChange, loading, refetching, onNew, onRowAction }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">All campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage draft, scheduled, running, and completed campaigns.</p>
        </div>
        <button
          onClick={onNew}
          className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all"
        >
          <i className="ti ti-plus" /> New campaign
        </button>
      </div>

      <div className="p-5">
        <DataTable
          tableKey={TABLE_KEY}
          schema={schema}
          rows={rows}
          meta={meta}
          state={tableState}
          loading={loading}
          refetching={refetching}
          onStateChange={onTableStateChange}
          onRowAction={onRowAction}
        />
      </div>
    </div>
  )
}
