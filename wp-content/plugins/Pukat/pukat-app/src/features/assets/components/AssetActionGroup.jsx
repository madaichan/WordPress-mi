import clsx from 'clsx'

const TONE_CLASS = {
  gray: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
  red: 'border border-red-100 bg-white text-red-600 hover:bg-red-50',
}

export default function AssetActionGroup({ variant = 'card', actions = [] }) {
  if (variant !== 'card' || actions.length === 0) return null

  return (
    <div className="mt-4 flex gap-2 border-t border-gray-50 pt-3">
      {actions.map(action => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          title={action.title}
          aria-label={action.label}
          className={clsx(
            'flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',
            TONE_CLASS[action.tone || 'gray']
          )}
        >
          <i className={clsx('ti text-sm', action.icon)} />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  )
}
