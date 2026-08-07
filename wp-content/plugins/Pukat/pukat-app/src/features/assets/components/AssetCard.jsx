import clsx from 'clsx'
import AssetLockBadge from './AssetLockBadge.jsx'
import AssetActionGroup from './AssetActionGroup.jsx'

export default function AssetCard({ asset, type, title, description, meta, chips, entity, locked, lockReason, thumbnail, actions, statusBadge }) {
  return (
    <div
      className="flex h-80 flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-none transition-all hover:border-gray-300"
      data-asset-type={type}
      data-category={asset?.category}
      data-title={title}
    >
      <div className="space-y-4">
        {thumbnail}
        <div>
          {chips ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              </div>
              {meta && <p className="mt-0.5 text-[10px] text-gray-400">{meta}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {statusBadge && (
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-[9px] font-semibold', statusBadge.cls)}>
                    {statusBadge.label}
                  </span>
                )}
                {chips.map(chip => (
                  <span key={chip.label} className={clsx('rounded-full px-2.5 py-0.5 text-[9px] font-semibold', chip.cls)}>
                    {chip.label}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-gray-900">{title}</h3>
              {description && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {statusBadge && (
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-[9px] font-semibold', statusBadge.cls)}>
                    {statusBadge.label}
                  </span>
                )}
                {entity && (
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-semibold text-gray-600">
                    {entity}
                  </span>
                )}
                <AssetLockBadge locked={locked} reason={lockReason} />
              </div>
            </>
          )}
        </div>
      </div>
      <AssetActionGroup variant="card" actions={actions} />
    </div>
  )
}
