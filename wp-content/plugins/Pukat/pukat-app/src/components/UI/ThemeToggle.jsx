import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import useAppStore from '../../store/useAppStore.js'

const OPTIONS = [
  { key: 'light',  label: 'Light',  icon: 'ti-sun' },
  { key: 'dark',   label: 'Dark',   icon: 'ti-moon' },
  { key: 'system', label: 'System', icon: 'ti-device-desktop' },
]

/**
 * ThemeToggle — light/dark/system switcher.
 *
 * Click toggles light ⇄ dark straight away; the caret opens the menu where
 * 'System' (follow the OS) can be picked back up. The icon always reflects
 * the *resolved* theme, so 'System' still reads as sun or moon on screen.
 */
export default function ThemeToggle({ className }) {
  const theme = useAppStore((s) => s.theme)
  const resolvedTheme = useAppStore((s) => s.resolvedTheme)
  const setTheme = useAppStore((s) => s.setTheme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
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

  const activeLabel = OPTIONS.find(o => o.key === theme)?.label ?? 'System'

  return (
    <div className={clsx('relative flex items-center', className)} ref={rootRef}>
      <button
        type="button"
        onClick={toggleTheme}
        title={`Theme: ${activeLabel} — switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'}`}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}
        className="flex h-8 w-8 items-center justify-center rounded-l-lg text-ink-muted transition-colors hover:bg-panel-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet-400/40"
      >
        <i className={clsx('ti text-base', resolvedTheme === 'dark' ? 'ti-moon' : 'ti-sun')} />
      </button>

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Theme options"
        className="flex h-8 w-4 items-center justify-center rounded-r-lg text-ink-faint transition-colors hover:bg-panel-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-violet-400/40"
      >
        <i className={clsx('ti ti-chevron-down text-[10px] transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-lg"
        >
          {OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.key}
              onClick={() => {
                setTheme(option.key)
                setOpen(false)
              }}
              className={clsx(
                'flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors',
                theme === option.key
                  ? 'bg-violet-500/10 font-medium text-violet-fg'
                  : 'text-ink-soft hover:bg-panel-subtle'
              )}
            >
              <i className={clsx('ti text-base', option.icon)} />
              {option.label}
              {theme === option.key && <i className="ti ti-check ml-auto text-xs" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
