import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import useAppStore from '../../store/useAppStore.js'

const adminUrl = window.PukatData?.adminUrl || '/wp-admin/'
const logoutUrl = window.PukatData?.logoutUrl || `${adminUrl}wp-login.php?action=logout`

const MENU_ITEMS = [
  { key: 'profile', label: 'Profile', icon: 'ti-user', href: `${adminUrl}profile.php` },
  { key: 'account-settings', label: 'Account Settings', icon: 'ti-settings', href: `${adminUrl}profile.php#password` },
  { key: 'logout', label: 'Log out', icon: 'ti-logout', href: logoutUrl, danger: true },
]

function initialsFromName(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'WP'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

export default function UserMenu() {
  const user = useAppStore((s) => s.user)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-gray-100"
      >
        <span className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
          {initialsFromName(user?.displayName)}
        </span>
        <span className="max-w-[140px] truncate text-sm font-medium text-gray-700">
          {user?.displayName || 'Unknown'}
        </span>
        <i className={clsx('ti ti-chevron-down text-xs text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {MENU_ITEMS.map(item => (
            <a
              key={item.key}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <i className={clsx('ti text-base', item.icon)} />
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
