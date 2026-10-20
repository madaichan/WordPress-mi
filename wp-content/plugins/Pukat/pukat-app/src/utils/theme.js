/**
 * Theme preference plumbing for the light/dark design tokens.
 *
 * Three preferences are stored: 'light' and 'dark' pin a theme, 'system'
 * follows the OS via `prefers-color-scheme`. Only the *preference* is
 * persisted — the resolved theme is derived, so a user on 'system' keeps
 * following the OS after a reload.
 *
 * Every DOM/storage touch is guarded and injectable: the app runs inside the
 * WP admin shell (and the test suite renders on the server), so neither
 * `window` nor a working localStorage can be assumed.
 */

export const THEME_STORAGE_KEY = 'pukat:theme'

export const THEME_PREFERENCES = ['light', 'dark', 'system']

const DARK_CLASS = 'dark'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isThemePreference(value) {
  return THEME_PREFERENCES.includes(value)
}

function safeWindow(win) {
  if (win) return win
  return typeof window === 'undefined' ? null : window
}

/**
 * Read the persisted preference, falling back to 'system'.
 * A blocked or absent localStorage (private mode, WP iframe) must not throw.
 */
export function readStoredTheme(win) {
  const w = safeWindow(win)
  try {
    const stored = w?.localStorage?.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(preference, win) {
  if (!isThemePreference(preference)) return false
  const w = safeWindow(win)
  try {
    w?.localStorage?.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}

/** The OS-level theme. Defaults to light when the query is unsupported. */
export function systemTheme(win) {
  const w = safeWindow(win)
  try {
    return w?.matchMedia?.(DARK_QUERY)?.matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Collapse a preference into the theme actually rendered. */
export function resolveTheme(preference, win) {
  if (preference === 'dark' || preference === 'light') return preference
  return systemTheme(win)
}

/**
 * Put the resolved theme on <html> and return it. The `dark` class is what
 * Tailwind's `darkMode: 'class'` and index.css's `.dark` token block key off.
 */
export function applyTheme(preference, win) {
  const resolved = resolveTheme(preference, win)
  const w = safeWindow(win)
  const root = w?.document?.documentElement

  if (root?.classList) {
    root.classList.toggle(DARK_CLASS, resolved === 'dark')
    root.dataset.pukatTheme = resolved
    root.style.colorScheme = resolved
  }

  return resolved
}

/**
 * Watch the OS theme. The callback fires with 'light'/'dark' on change;
 * returns an unsubscribe function (a no-op when matchMedia is missing).
 */
export function subscribeToSystemTheme(callback, win) {
  const w = safeWindow(win)
  let query
  try {
    query = w?.matchMedia?.(DARK_QUERY)
  } catch {
    query = null
  }
  if (!query) return () => {}

  const handler = (event) => callback(event.matches ? 'dark' : 'light')

  // Safari < 14 only has the deprecated addListener API.
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler)
    return () => query.removeEventListener('change', handler)
  }
  if (typeof query.addListener === 'function') {
    query.addListener(handler)
    return () => query.removeListener(handler)
  }
  return () => {}
}

/** Light ⇄ dark from what is on screen now; 'system' flips to the opposite. */
export function nextTheme(preference, win) {
  return resolveTheme(preference, win) === 'dark' ? 'light' : 'dark'
}
