import clsx from 'clsx'
import { ACTIVITY_FEED } from './overviewData.js'

export default function ActivityFeedCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Recent activity</h3>
      <div className="space-y-4">
        {ACTIVITY_FEED.map(item => (
          <div key={`${item.title}-${item.body}`} className="flex gap-3 text-sm">
            <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', item.color)}>
              <i className={clsx('ti text-base', item.icon)} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-800">
                <strong className="font-semibold text-gray-950">{item.title}</strong> {item.body}
              </p>
              <p className="mt-1 text-xs text-gray-400">{item.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
