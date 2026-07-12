/**
 * PageLoader.jsx
 *
 * Shared full-page lazy-load spinner used as the Suspense fallback
 * in AppAdmin and AppFrontend.
 *
 * Extracted from AppAdmin.jsx and AppFrontend.jsx where the component
 * was defined identically in both files.
 *
 * Used by:
 *  - src/AppAdmin.jsx    (Suspense fallback for all lazy admin pages)
 *  - src/AppFrontend.jsx (Suspense fallback for all lazy frontend pages)
 */
export default function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    </div>
  )
}
