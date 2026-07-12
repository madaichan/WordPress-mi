import { describe, expect, it } from 'vitest'
import { highlightHtml } from './htmlHighlight.js'

describe('highlightHtml', () => {
  it('escapes raw HTML before injecting highlight spans', () => {
    const result = highlightHtml('<img src=x onerror="alert(1)">')

    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;')
    expect(result).toContain('text-blue-400')
  })

  it('highlights comments, doctype, tags, and attributes', () => {
    const result = highlightHtml('<!DOCTYPE html>\n<!-- note -->\n<a href="{{.URL}}">Open</a>')

    expect(result).toContain('text-gray-500 italic')
    expect(result).toContain('text-blue-400')
    expect(result).toContain('text-yellow-400')
    expect(result).toContain('text-green-300')
  })
})
