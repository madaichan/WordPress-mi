import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

/**
 * "More Actions" kebab trigger + floating menu for a DataTable row. Renders the panel
 * through a portal (not inside the table cell) so it never gets clipped by the table's
 * horizontal-scroll container, and positions itself from the trigger's live bounding box.
 *
 * Flips to open upward (and nudges horizontally) when the default placement would run
 * off the viewport — e.g. the last row of a table near the bottom of the screen.
 */
export default function TableActionMenu({ items, triggerTitle = 'More Actions', onSelect }) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  // Measures the menu's actual rendered size before it's visible, so placement is exact
  // rather than guessed — runs synchronously before paint so there's no visible jump.
  useLayoutEffect(() => {
    if (!open) return

    const buttonRect = buttonRef.current?.getBoundingClientRect()
    const menuEl = menuRef.current
    if (!buttonRect || !menuEl) return

    const menuRect = menuEl.getBoundingClientRect()
    const spaceBelow = window.innerHeight - buttonRect.bottom
    const spaceAbove = buttonRect.top
    const openUpward = spaceBelow < menuRect.height + 8 && spaceAbove > spaceBelow

    // Default alignment right-edge-aligns the menu to the button (menu extends leftward);
    // only flip to left-edge-aligned if that would push the menu off the left of the screen.
    const overflowsLeft = buttonRect.right - menuRect.width < 0

    const next = {}
    if (openUpward) {
      next.bottom = window.innerHeight - buttonRect.top + 4
    } else {
      next.top = buttonRect.bottom + 4
    }
    if (overflowsLeft) {
      next.left = buttonRect.left
    } else {
      next.left = buttonRect.right
      next.transform = 'translateX(-100%)'
    }
    setStyle(next)
  }, [open])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event) {
      if (buttonRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setStyle(null)
    setOpen(true)
  }

  if (!items || items.length === 0) return null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        title={triggerTitle}
        aria-label={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={clsx(
          'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-all',
          'hover:border-violet-500 hover:bg-violet-50 hover:text-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/40',
          open && 'border-violet-500 bg-violet-50 text-violet-500'
        )}
      >
        <i className="ti ti-dots-vertical text-xs" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', visibility: style ? 'visible' : 'hidden', ...(style || { top: 0, left: 0 }) }}
          className="z-50 min-w-[170px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.reason : ''}
              onClick={() => {
                setOpen(false)
                onSelect?.(item.key)
              }}
              className={clsx(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors',
                item.disabled ? 'cursor-not-allowed text-gray-300' : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <i className={clsx('ti text-sm', item.icon)} />
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
