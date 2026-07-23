import clsx from 'clsx'
import { IconButton } from './Button.jsx'

export default function Modal({ open = true, onClose, title, subtitle, icon, footer, className, children }) {
  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div className={clsx('modal', className)}>
        {(title || onClose) && (
          <header className="modal-header">
            <div className="flex items-center gap-3">
              {icon}
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <IconButton label="Close" onClick={onClose}>
                <i className="ti ti-x text-base" />
              </IconButton>
            )}
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  )
}
