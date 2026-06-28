import { create } from 'zustand'

/**
 * Global Zustand store.
 * Holds GoPhish connection status and current user context.
 */
const useAppStore = create((set, get) => ({
  // ── User (injected by WP) ──────────────────────────────────────
  user: window.PukatData?.user || {
    id: 0,
    displayName: 'Unknown',
    email: '',
    role: 'viewer',
  },

  // ── GoPhish connection ─────────────────────────────────────────
  gophishStatus: 'unknown', // 'unknown' | 'checking' | 'connected' | 'disconnected'
  setGophishStatus: (status) => set({ gophishStatus: status }),

  // ── Sidebar collapsed state ────────────────────────────────────
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // ── Global toast queue (react-hot-toast handles this) ─────────
  // Nothing needed here — react-hot-toast has its own context.

  // ── Helpers ────────────────────────────────────────────────────
  isAdmin:    () => ['admin'].includes(get().user.role),
  isOperator: () => ['admin', 'operator'].includes(get().user.role),
}))

export default useAppStore
