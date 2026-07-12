import { Toaster } from 'react-hot-toast'

/**
 * AppToaster.jsx
 *
 * Shared react-hot-toast configuration, extracted from AppAdmin.jsx and
 * AppFrontend.jsx where it was defined identically in both.
 */
export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '10px',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
        },
        success: {
          style: { background: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7' },
        },
        error: {
          style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' },
        },
      }}
    />
  )
}
