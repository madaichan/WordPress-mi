import { create } from 'zustand'
import { canManagePukat, canOperatePukat, normalizePukatRole } from '../utils/roles.js'

const injectedUser = window.PukatData?.user
const fallbackUser = {
  id: 0,
  displayName: 'Unknown',
  email: '',
  role: 'pukat_viewer',
}

function normalizeUser(user) {
  return {
    ...user,
    role: normalizePukatRole(user.role ?? user.pukat_role),
  }
}

/**
 * Global Zustand store.
 * Holds current user context and sidebar UI state.
 */
const useAppStore = create((set, get) => ({
  // ── User (injected by WP) ──────────────────────────────────────
  user: normalizeUser(injectedUser || fallbackUser),

  // ── Sidebar collapsed state ────────────────────────────────────
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ── Global toast queue (react-hot-toast handles this) ─────────
  // Nothing needed here — react-hot-toast has its own context.

  // ── Helpers ────────────────────────────────────────────────────
  isAdmin:    () => canManagePukat(get().user.role),
  isOperator: () => canOperatePukat(get().user.role),
}))

export default useAppStore
