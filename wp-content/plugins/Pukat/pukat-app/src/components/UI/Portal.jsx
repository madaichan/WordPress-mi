import { createPortal } from 'react-dom'

/**
 * Renders children into document.body, outside the page's component tree.
 *
 * Use for every viewport-level overlay (modal, drawer, slideover, preview).
 * Rendered inline, a `fixed` overlay inherits layout from its ancestors —
 * e.g. PageShell's `space-y-*` adds margin-top to it, and any ancestor with
 * transform/filter turns into its containing block — leaving a gap at the top.
 */
export default function Portal({ children }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
