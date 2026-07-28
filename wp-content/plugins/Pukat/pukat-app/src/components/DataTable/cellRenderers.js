const KNOWN_RENDERERS = new Set([
  'text',
  'text_with_subtext',
  'badge',
  'status_badge',
  'date',
  'datetime',
  'number',
  'email',
  'link',
])

export function isKnownRenderer(renderer) {
  return KNOWN_RENDERERS.has(renderer)
}

export function formatDateValue(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Day+time precision, unlike formatDateValue — for tables where the time of day matters (e.g. audit trails). */
export function formatDateTimeValue(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatNumberValue(value) {
  if (value === null || value === undefined || value === '') return ''

  const number = Number(value)
  if (Number.isNaN(number)) return String(value)

  return number.toLocaleString()
}

/**
 * Resolves a column + row into a plain, renderer-tagged content descriptor.
 * Kept free of JSX/React so it stays trivially unit-testable; DataTable.jsx
 * turns the descriptor into markup.
 */
export function resolveCellContent(column, row) {
  const value = row ? row[column.key] : undefined
  const renderer = isKnownRenderer(column.renderer) ? column.renderer : 'text'

  switch (renderer) {
    case 'text_with_subtext':
      return {
        renderer,
        primary: value ?? '',
        subtext: column.subtextKey ? row?.[column.subtextKey] ?? '' : '',
      }
    case 'badge':
    case 'status_badge':
      return {
        renderer,
        label: value ?? '',
        tone: (column.toneMap && column.toneMap[value]) || column.tone || 'gray',
      }
    case 'date':
      return { renderer, label: formatDateValue(value) }
    case 'datetime':
      return { renderer, label: formatDateTimeValue(value) }
    case 'number':
      return { renderer, label: formatNumberValue(value) }
    case 'email':
      return { renderer, label: value ?? '' }
    case 'link':
      return {
        renderer,
        label: value ?? '',
        href: column.hrefKey ? row?.[column.hrefKey] ?? '' : (typeof value === 'string' ? value : ''),
      }
    case 'text':
    default:
      return { renderer: 'text', label: value === null || value === undefined ? '' : String(value) }
  }
}
