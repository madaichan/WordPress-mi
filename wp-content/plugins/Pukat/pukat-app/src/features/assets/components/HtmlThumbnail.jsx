import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

/**
 * Scaled-down, non-interactive live render of an asset's HTML (email template
 * or landing page) for use as a card thumbnail. Lazy-mounts the iframe only
 * once the card scrolls near the viewport, and scripts are blocked via an
 * empty sandbox since this is a passive preview, not the editor/client preview.
 */
export default function HtmlThumbnail({ html, designWidth = 1000, designHeight = 750, className }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(0)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShouldRender(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldRender(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateScale = () => setScale(el.clientWidth / designWidth)
    updateScale()

    if (typeof ResizeObserver === 'undefined') return
    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(el)
    return () => resizeObserver.disconnect()
  }, [designWidth])

  return (
    <div ref={containerRef} className={clsx('relative h-full w-full overflow-hidden bg-white', className)}>
      {shouldRender && scale > 0 ? (
        <iframe
          srcDoc={html || '<body></body>'}
          title="Asset preview"
          tabIndex={-1}
          sandbox=""
          scrolling="no"
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            border: 'none',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-gray-100" />
      )}
    </div>
  )
}
