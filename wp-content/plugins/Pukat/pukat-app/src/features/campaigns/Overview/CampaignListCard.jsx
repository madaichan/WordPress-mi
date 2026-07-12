import clsx from 'clsx'
import { statusLabel, dotColor, formatDate } from '../../../utils/campaignHelpers.js'

export default function CampaignListCard({ campaigns, onNew }) {
  const shown = campaigns.slice(0, 4)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Campaigns</h3>
        <button
          onClick={onNew}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-violet-500 hover:bg-violet-50 transition-colors"
          title="New campaign"
        >
          <i className="ti ti-plus text-lg" />
        </button>
      </div>
      <div className="space-y-4">
        {shown.map((campaign, index) => {
          const { label, cls } = statusLabel(campaign.status)
          const date = formatDate(campaign.launched_at || campaign.scheduled_at, { day: 'numeric', month: 'short', year: 'numeric' })
          return (
            <div key={campaign.id || index} className={clsx('flex items-center justify-between gap-3', index < shown.length - 1 && 'border-b border-gray-100 pb-3')}>
              <div className="flex items-start gap-2.5 min-w-0">
                <span className={clsx('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', dotColor(campaign.status))} />
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">{campaign.name}</h4>
                  <span className="text-xs text-gray-500">{date || 'Not scheduled'}</span>
                </div>
              </div>
              <span className={clsx('rounded-full text-xs font-semibold px-2 py-0.5 flex-shrink-0', cls)}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
