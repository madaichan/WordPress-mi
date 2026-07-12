import { useCallback, useMemo, useRef } from 'react'
import { highlightHtml } from '../../utils/htmlHighlight.js'

/**
 * HtmlCodeEditor.jsx
 *
 * Functional HTML code editor with a syntax-highlighted overlay, dynamic
 * line numbers, and Tab-to-indent — built from a real <textarea> (transparent
 * text) stacked over a highlighted <pre> layer, with synchronized scrolling.
 *
 * Extracted from EmailTemplates.jsx, MasterEmailTemplates.jsx, and
 * LandingPages.jsx where this component was defined near-identically in all
 * three (only the fixed editor height differed: 400px vs 420px).
 *
 * Used by:
 *  - src/pages/Simulation/EmailTemplates.jsx    (height: 400, default)
 *  - src/pages/Admin/MasterEmailTemplates.jsx   (height: 400, default)
 *  - src/pages/Simulation/LandingPages.jsx      (height: 420)
 */
export default function HtmlCodeEditor({ value, onChange, height = 400 }) {
  const textareaRef = useRef(null)
  const highlightRef = useRef(null)
  const lineNumRef = useRef(null)

  const lineCount = value.split('\n').length

  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop
      highlightRef.current.scrollLeft = textarea.scrollLeft
    }
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = textarea.scrollTop
    }
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.target
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newVal = ta.value.substring(0, start) + '  ' + ta.value.substring(end)
      onChange(newVal)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }, [onChange])

  const highlighted = useMemo(() => highlightHtml(value), [value])

  return (
    <div className="bg-[#1e1e1e] font-mono text-[11px] flex relative" style={{ height }}>
      <div
        ref={lineNumRef}
        className="text-gray-600 select-none text-right pr-3 pl-3 border-r border-gray-800 flex-shrink-0 overflow-hidden pt-4 pb-4 animate-fade-in"
        style={{ width: 48, lineHeight: '1.625' }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className="h-[17.875px] flex items-center justify-end">{i + 1}</div>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <pre
          ref={highlightRef}
          className="absolute inset-0 p-4 m-0 overflow-hidden pointer-events-none text-gray-300 whitespace-pre-wrap break-words"
          style={{ lineHeight: '1.625', wordBreak: 'break-all' }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className="absolute inset-0 w-full h-full resize-none p-4 m-0 bg-transparent border-none outline-none overflow-auto"
          style={{
            lineHeight: '1.625',
            color: 'transparent',
            caretColor: '#d4d4d4',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        />
      </div>
    </div>
  )
}
