import { describe, expect, it, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyTheme,
  isThemePreference,
  nextTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  subscribeToSystemTheme,
  systemTheme,
} from './theme.js'

/** Minimal stand-in for the browser globals theme.js touches. */
function fakeWindow({ stored, prefersDark = false, storageThrows = false, matchMedia = true } = {}) {
  const classes = new Set()
  const listeners = []
  const store = new Map()
  if (stored !== undefined) store.set(THEME_STORAGE_KEY, stored)

  return {
    classes,
    listeners,
    localStorage: {
      getItem: (k) => {
        if (storageThrows) throw new Error('blocked')
        return store.has(k) ? store.get(k) : null
      },
      setItem: (k, v) => {
        if (storageThrows) throw new Error('blocked')
        store.set(k, v)
      },
    },
    matchMedia: matchMedia
      ? () => ({
          matches: prefersDark,
          addEventListener: (_event, handler) => listeners.push(handler),
          removeEventListener: (_event, handler) => {
            const i = listeners.indexOf(handler)
            if (i >= 0) listeners.splice(i, 1)
          },
        })
      : undefined,
    document: {
      documentElement: {
        dataset: {},
        style: {},
        classList: {
          toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
          contains: (name) => classes.has(name),
        },
      },
    },
  }
}

describe('isThemePreference', () => {
  it('accepts only the three known preferences', () => {
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('navy')).toBe(false)
    expect(isThemePreference(undefined)).toBe(false)
  })
})

describe('readStoredTheme', () => {
  it('returns the persisted preference', () => {
    expect(readStoredTheme(fakeWindow({ stored: 'dark' }))).toBe('dark')
  })

  it('falls back to system for an absent or junk value', () => {
    expect(readStoredTheme(fakeWindow())).toBe('system')
    expect(readStoredTheme(fakeWindow({ stored: 'midnight' }))).toBe('system')
  })

  it('falls back to system when storage throws', () => {
    expect(readStoredTheme(fakeWindow({ stored: 'dark', storageThrows: true }))).toBe('system')
  })

  it('survives a missing window', () => {
    expect(readStoredTheme(null)).toBe('system')
  })
})

describe('storeTheme', () => {
  it('persists a valid preference', () => {
    const win = fakeWindow()
    expect(storeTheme('dark', win)).toBe(true)
    expect(readStoredTheme(win)).toBe('dark')
  })

  it('refuses an unknown preference', () => {
    const win = fakeWindow()
    expect(storeTheme('neon', win)).toBe(false)
    expect(readStoredTheme(win)).toBe('system')
  })

  it('reports failure instead of throwing when storage is blocked', () => {
    expect(storeTheme('dark', fakeWindow({ storageThrows: true }))).toBe(false)
  })
})

describe('systemTheme', () => {
  it('reads prefers-color-scheme', () => {
    expect(systemTheme(fakeWindow({ prefersDark: true }))).toBe('dark')
    expect(systemTheme(fakeWindow({ prefersDark: false }))).toBe('light')
  })

  it('defaults to light without matchMedia', () => {
    expect(systemTheme(fakeWindow({ matchMedia: false }))).toBe('light')
  })
})

describe('resolveTheme', () => {
  it('pins light and dark regardless of the OS', () => {
    const win = fakeWindow({ prefersDark: true })
    expect(resolveTheme('light', win)).toBe('light')
    expect(resolveTheme('dark', win)).toBe('dark')
  })

  it('follows the OS for system', () => {
    expect(resolveTheme('system', fakeWindow({ prefersDark: true }))).toBe('dark')
    expect(resolveTheme('system', fakeWindow({ prefersDark: false }))).toBe('light')
  })
})

describe('applyTheme', () => {
  it('adds the dark class for a dark resolution', () => {
    const win = fakeWindow()
    expect(applyTheme('dark', win)).toBe('dark')
    expect(win.classes.has('dark')).toBe(true)
    expect(win.document.documentElement.dataset.pukatTheme).toBe('dark')
    expect(win.document.documentElement.style.colorScheme).toBe('dark')
  })

  it('removes the dark class for a light resolution', () => {
    const win = fakeWindow()
    applyTheme('dark', win)
    expect(applyTheme('light', win)).toBe('light')
    expect(win.classes.has('dark')).toBe(false)
  })

  it('resolves system against the OS', () => {
    const win = fakeWindow({ prefersDark: true })
    expect(applyTheme('system', win)).toBe('dark')
    expect(win.classes.has('dark')).toBe(true)
  })

  it('is a safe no-op without a window', () => {
    expect(applyTheme('dark', null)).toBe('dark')
  })
})

describe('subscribeToSystemTheme', () => {
  it('reports OS changes and unsubscribes cleanly', () => {
    const win = fakeWindow()
    const seen = vi.fn()
    const unsubscribe = subscribeToSystemTheme(seen, win)

    expect(win.listeners).toHaveLength(1)
    win.listeners[0]({ matches: true })
    expect(seen).toHaveBeenCalledWith('dark')
    win.listeners[0]({ matches: false })
    expect(seen).toHaveBeenCalledWith('light')

    unsubscribe()
    expect(win.listeners).toHaveLength(0)
  })

  it('returns a no-op unsubscribe without matchMedia', () => {
    const unsubscribe = subscribeToSystemTheme(vi.fn(), fakeWindow({ matchMedia: false }))
    expect(() => unsubscribe()).not.toThrow()
  })
})

describe('nextTheme', () => {
  it('flips the theme currently on screen', () => {
    const win = fakeWindow({ prefersDark: true })
    expect(nextTheme('light', win)).toBe('dark')
    expect(nextTheme('dark', win)).toBe('light')
    // 'system' resolving dark flips to an explicit light.
    expect(nextTheme('system', win)).toBe('light')
  })
})
