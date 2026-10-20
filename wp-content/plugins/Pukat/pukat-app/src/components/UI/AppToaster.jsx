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
        // Colours come from the theme tokens in index.css rather than
        // literals, so toasts follow light/dark like the rest of the UI.
        style: {
          borderRadius: '10px',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          background: 'rgb(var(--pk-toast-bg))',
          color: 'rgb(var(--pk-toast-fg))',
          border: '1px solid rgb(var(--pk-toast-border))',
        },
        success: {
          style: {
            background: 'rgb(var(--pk-toast-success-bg))',
            color: 'rgb(var(--pk-toast-success-fg))',
            border: '1px solid rgb(var(--pk-toast-success-bd))',
          },
        },
        error: {
          style: {
            background: 'rgb(var(--pk-toast-error-bg))',
            color: 'rgb(var(--pk-toast-error-fg))',
            border: '1px solid rgb(var(--pk-toast-error-bd))',
          },
        },
      }}
    />
  )
}
