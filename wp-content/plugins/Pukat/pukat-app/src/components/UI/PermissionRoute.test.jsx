import { MemoryRouter } from 'react-router-dom'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PermissionRoute from './PermissionRoute.jsx'

// Real useAppStore.js reads `window.PukatData` at module-eval time (WP
// bootstrap context, absent under Vitest's Node environment — no jsdom in
// this project, see project-pukat memory) and, more importantly, Zustand
// v4's useSyncExternalStore reports `getInitialState()` (frozen at store
// creation) rather than live state during SSR — so mutating the real store
// with `.setState()` before a renderToStaticMarkup call wouldn't even be
// visible. Mocking the hook sidesteps both issues and tests exactly what
// PermissionRoute itself does with whatever permissions come back.
let mockPermissions = []
vi.mock('../../store/useAppStore.js', () => ({
  default: (selector) => selector({ permissions: mockPermissions }),
}))

function markup(permission) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PermissionRoute permission={permission}>
        <div data-testid="guarded-content">Secret content</div>
      </PermissionRoute>
    </MemoryRouter>
  )
}

describe('PermissionRoute', () => {
  it('renders children when the current user holds the required permission', () => {
    mockPermissions = ['dashboard.view']
    expect(markup('dashboard.view')).toContain('Secret content')
  })

  it('does not render children when the required permission is missing', () => {
    mockPermissions = ['dashboard.view']
    expect(markup('users.manage_roles')).not.toContain('Secret content')
  })

  it('always renders children when no permission is required', () => {
    mockPermissions = []
    expect(markup(undefined)).toContain('Secret content')
  })

  it('blocks access even with zero permissions loaded (fail closed)', () => {
    mockPermissions = []
    expect(markup('dashboard.view')).not.toContain('Secret content')
  })
})
