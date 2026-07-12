/**
 * htmlHighlight.js
 *
 * Lightweight HTML syntax highlighter (comments, DOCTYPE, tags/attributes)
 * used by the code editor preview panes.
 *
 * Extracted from EmailTemplates.jsx, MasterEmailTemplates.jsx, and
 * LandingPages.jsx where the function was defined identically in all three.
 *
 * Used by:
 *  - src/components/Editor/HtmlCodeEditor.jsx
 */
export function highlightHtml(code) {
  let safe = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  safe = safe.replace(
    /(&lt;!--[\s\S]*?--&gt;)/g,
    '<span class="text-gray-500 italic">$1</span>'
  )

  safe = safe.replace(
    /(&lt;!DOCTYPE\s+[^&]*&gt;)/gi,
    '<span class="text-blue-400">$1</span>'
  )

  safe = safe.replace(
    /(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)([^&]*?)(\/?)(&gt;)/g,
    (_, open, tagName, attrs, selfClose, close) => {
      const highlightedAttrs = attrs.replace(
        /([a-zA-Z-]+)(=)(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;|[^\s&]+)/g,
        '<span class="text-yellow-400">$1$2</span><span class="text-green-300">$3</span>'
      )
      return `<span class="text-blue-400">${open}${tagName}</span>${highlightedAttrs}<span class="text-blue-400">${selfClose}${close}</span>`
    }
  )

  return safe
}
