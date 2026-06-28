import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

// Error boundary to display actual errors on screen for debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this._errorInfo = null
  }
  static getDerivedStateFromError(error) {
    // Only update state here — this is the correct phase for state changes.
    // NEVER call setState in componentDidCatch; doing so triggers a second
    // re-render while React's hook dispatcher is still in error-handling mode,
    // which causes Error #321 (invalid hook call) and cascading removeChild crashes.
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    // Side-effects only — no setState. Store info without triggering a render.
    this._errorInfo = info
    console.error('[Pukat] Runtime error:', error)
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        id: 'pukat-error',
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#0F1629', padding: '40px',
        }
      },
        React.createElement('div', {
          style: {
            maxWidth: '560px', width: '100%', background: '#1a2447',
            border: '1px solid #ff4444', borderRadius: '12px', padding: '32px',
            fontFamily: 'Inter, monospace', color: '#ff6b6b',
          }
        },
          React.createElement('p', { style: { fontWeight: 700, fontSize: '16px', marginBottom: '12px' } },
            'Application error'
          ),
          React.createElement('pre', {
            style: {
              fontSize: '12px', color: '#aaa', whiteSpace: 'pre-wrap',
              wordBreak: 'break-all', maxHeight: '200px', overflowY: 'auto',
              background: '#0F1629', padding: '12px', borderRadius: '6px',
            }
          }, String(this.state.error)),
          React.createElement('button', {
            onClick: () => window.location.reload(),
            style: {
              marginTop: '20px', padding: '8px 20px', background: '#7c3aed',
              color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }
          }, 'Reload page')
        )
      )
    }
    return this.props.children
  }
}

// Create React Query client with sensible defaults for WP REST API
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:        30_000,  // 30s
      gcTime:           300_000, // 5min
      retry:            1,
      refetchOnWindowFocus: false,
    },
  },
})

const container = document.getElementById('pukat-root')
if (!container) {
  console.error('[Pukat] Mount pointst #pukat-root not found.')
} else {
  // Lift #pukat-app-wrapper to document.body so it sits outside WP admin's
  // #wpwrap/.wrap DOM subtree. WP admin scripts (admin.min.js, common.js, etc.)
  // only manipulate elements inside #wpwrap; they never touch siblings of #wpwrap.
  // Without this, WP scripts move nodes inside .wrap between React renders, causing
  // "removeChild: node is not a child" DOM reconciliation crashes.
  const wrapper = document.getElementById('pukat-app-wrapper')
  if (wrapper && wrapper.parentNode !== document.body) {
    document.body.appendChild(wrapper)
  }

  // Container is now a child of the relocated wrapper — still safe to mount.
  // Remove the PHP loading indicator so #pukat-root is empty before createRoot.
  const loader = document.getElementById('pukat-loading')
  if (loader) loader.remove()

  ReactDOM.createRoot(container).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
