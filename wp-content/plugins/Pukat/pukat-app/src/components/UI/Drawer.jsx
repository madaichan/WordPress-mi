import clsx from 'clsx'
import { IconButton } from './Button.jsx'

export default function Drawer({ onClose, title, subtitle, icon, headerExtra, footer, widthClass = 'max-w-md', className, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-gray-950/40 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <aside className={clsx('flex h-full w-full flex-col bg-white shadow-2xl animate-slide-in', widthClass, className)}>
        {(title || onClose) && (
          <header className="flex items-start gap-3 border-b border-gray-100 p-5">
            {icon}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
            </div>
            {headerExtra}
            {onClose && (
              <IconButton label="Close" onClick={onClose}>
                <i className="ti ti-x text-base" />
              </IconButton>
            )}
          </header>
        )}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 p-5">{footer}</footer>}
      </aside>
    </div>
  )
}
