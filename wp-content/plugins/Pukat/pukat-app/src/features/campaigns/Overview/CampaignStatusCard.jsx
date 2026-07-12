import clsx from 'clsx'

export default function CampaignStatusCard({ activeCampaign }) {
  const campaignName = activeCampaign?.name || 'Q2 phishing wave — finance'
  const sent = activeCampaign?.target_count ? Math.round(activeCampaign.target_count * 0.9) : 1118
  const total = activeCampaign?.target_count || 1240

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Status active campaigns</h3>
          <p className="text-xs text-gray-500 mt-0.5">{campaignName}</p>
        </div>
        <span className="rounded-full text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700">Running</span>
      </div>

      <div className="relative flex items-center justify-between w-full px-4 mb-8">
        <div className="absolute left-10 right-10 top-4 h-0.5 bg-gray-200 z-0">
          <div className="h-full bg-emerald-500" style={{ width: '50%' }} />
        </div>
        {['Pre sim', 'Preparation', 'Performing', 'Post sim', 'Follow up'].map((label, index) => {
          const done = index < 2
          const current = index === 2
          return (
            <div key={label} className="flex flex-col items-center z-10 flex-1 min-w-0">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                done && 'bg-emerald-100 text-emerald-700 border border-emerald-200',
                current && 'bg-violet-500 text-white',
                !done && !current && 'bg-gray-100 text-gray-400 border border-gray-200',
              )}>
                {done ? <i className="ti ti-check text-base" /> : index + 1}
              </div>
              <span className={clsx(
                'text-xs mt-2 truncate max-w-full',
                current ? 'font-semibold text-violet-500' : done ? 'font-medium text-gray-600' : 'font-medium text-gray-400',
              )}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Emails sent', value: sent.toLocaleString('en-US'), helper: `${Math.round((sent / total) * 100)}% of targets`, cls: 'text-emerald-600' },
          { label: 'Link clicks', value: '201', helper: '18% click rate', cls: 'text-amber-600' },
          { label: 'Data submitted', value: '87', helper: '43% of clickers', cls: 'text-red-600' },
        ].map(item => (
          <div key={item.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <span className="text-xs font-medium text-gray-500">{item.label}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-gray-900">{item.value}</span>
              <span className={clsx('text-xs font-semibold', item.cls)}>{item.helper}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
