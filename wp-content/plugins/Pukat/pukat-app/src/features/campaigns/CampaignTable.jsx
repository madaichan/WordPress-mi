import clsx from 'clsx'
import TableActionButton from '../UI/TableActionButton.jsx'
import { statusLabel, dotColor, formatDate } from '../../utils/campaignHelpers.js'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Running' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed' },
]

export default function CampaignTable({ items, search, setSearch, statusFilter, setFilter, isLoading, onNew, onDelete }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-5 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-gray-900">All campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage draft, scheduled, running, and completed campaigns.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full sm:w-56 bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={onNew}
            className="bg-violet-500 text-white hover:bg-violet-600 px-3 py-2 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all"
          >
            <i className="ti ti-plus" /> New campaign
          </button>
        </div>
      </div>

      <div className="px-5 pt-4 flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
              statusFilter === key ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto p-5">
        <table className="w-full text-left border-collapse text-xs text-gray-700">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Campaigns</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Target</th>
              <th className="py-2.5 px-4">Difficulty</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td colSpan={6} className="py-3 px-4">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-500">
                  No matching campaigns.
                </td>
              </tr>
            ) : items.map(campaign => {
              const { label, cls } = statusLabel(campaign.status)
              const date = formatDate(campaign.launched_at || campaign.scheduled_at)
              return (
                <tr key={campaign.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <div className="flex items-start gap-2.5">
                      <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor(campaign.status))} />
                      <div>
                        <p className="font-semibold text-gray-900">{campaign.name}</p>
                        <p className="text-[10px] text-gray-400">ID #{campaign.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={clsx('rounded-full text-[10px] font-semibold px-2 py-0.5', cls)}>{label}</span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{campaign.target_count?.toLocaleString('en-US') ?? '—'}</td>
                  <td className="py-3 px-4">{campaign.difficulty ? `${campaign.difficulty}/5` : '—'}</td>
                  <td className="py-3 px-4 text-gray-500">{date || '—'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <TableActionButton
                        to={`/reports/${campaign.id}`}
                        icon="ti-report-analytics"
                        label={`View report for ${campaign.name}`}
                        title="Lihat laporan"
                        size="md"
                        framed={false}
                      />
                      <TableActionButton
                        onClick={() => onDelete(campaign)}
                        icon="ti-trash"
                        label={`Delete ${campaign.name}`}
                        title="Delete campaign"
                        tone="red"
                        size="md"
                        framed={false}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
