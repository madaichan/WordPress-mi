import clsx from 'clsx'

export default function CampaignStatusCard({ activeCampaign }) {
  const campaignName = activeCampaign?.name || 'Q2 phishing wave — finance'
  const sent = activeCampaign?.target_count ? Math.round(activeCampaign.target_count * 0.9) : 1118
  const total = activeCampaign?.target_count || 1240

  return (
    <div className="bg-panel border border-line rounded-xl p-5">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-ink">Status active campaigns</h3>
          <p className="text-xs text-ink-muted mt-0.5">{campaignName}</p>
        </div>
        <span className="rounded-full text-xs font-semibold px-2 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300">Running</span>
      </div>

      <div className="relative flex items-center justify-between w-full px-4 mb-8">
        <div className="absolute left-10 right-10 top-4 h-0.5 bg-panel-strong z-0">
          <div className="h-full bg-emerald-500" style={{ width: '50%' }} />
        </div>
        {['Pre sim', 'Preparation', 'Performing', 'Post sim', 'Follow up'].map((label, index) => {
          const done = index < 2
          const current = index === 2
          return (
            <div key={label} className="flex flex-col items-center z-10 flex-1 min-w-0">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                done && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
                current && 'bg-violet-500 text-white',
                !done && !current && 'bg-panel-muted text-ink-faint border border-line',
              )}>
                {done ? <i className="ti ti-check text-base" /> : index + 1}
              </div>
              <span className={clsx(
                'text-xs mt-2 truncate max-w-full',
                current ? 'font-semibold text-violet-500' : done ? 'font-medium text-ink-muted' : 'font-medium text-ink-faint',
              )}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Emails sent', value: sent.toLocaleString('en-US'), helper: `${Math.round((sent / total) * 100)}% of targets`, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Link clicks', value: '201', helper: '18% click rate', cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Data submitted', value: '87', helper: '43% of clickers', cls: 'text-red-600 dark:text-red-400' },
        ].map(item => (
          <div key={item.label} className="bg-panel-subtle border border-line-soft rounded-xl p-4">
            <span className="text-xs font-medium text-ink-muted">{item.label}</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-ink">{item.value}</span>
              <span className={clsx('text-xs font-semibold', item.cls)}>{item.helper}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
