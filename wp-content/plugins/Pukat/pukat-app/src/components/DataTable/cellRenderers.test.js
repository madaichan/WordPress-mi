import { describe, expect, it } from 'vitest'
import { formatDateTimeValue, formatDateValue, formatNumberValue, isKnownRenderer, resolveCellContent } from './cellRenderers.js'

describe('cellRenderers', () => {
  it('recognizes the known MVP renderer set', () => {
    expect(isKnownRenderer('text')).toBe(true)
    expect(isKnownRenderer('status_badge')).toBe(true)
    expect(isKnownRenderer('actions')).toBe(false)
    expect(isKnownRenderer('nonsense')).toBe(false)
  })

  it('falls back unknown renderers safely to text', () => {
    const content = resolveCellContent({ key: 'name', renderer: 'nonsense' }, { name: 'Finance relay' })
    expect(content).toEqual({ renderer: 'text', label: 'Finance relay' })
  })

  it('falls back to empty label for null/undefined values', () => {
    expect(resolveCellContent({ key: 'name', renderer: 'text' }, { name: null })).toEqual({ renderer: 'text', label: '' })
    expect(resolveCellContent({ key: 'name', renderer: 'text' }, {})).toEqual({ renderer: 'text', label: '' })
  })

  it('builds text_with_subtext content from the configured subtextKey', () => {
    const content = resolveCellContent(
      { key: 'name', renderer: 'text_with_subtext', subtextKey: 'host' },
      { name: 'Finance relay', host: 'smtp.example.com' }
    )
    expect(content).toEqual({ renderer: 'text_with_subtext', primary: 'Finance relay', subtext: 'smtp.example.com' })
  })

  it('resolves badge tone from toneMap, falling back to column.tone then gray', () => {
    const withMap = resolveCellContent(
      { key: 'status', renderer: 'status_badge', toneMap: { Active: 'success', Inactive: 'gray' } },
      { status: 'Active' }
    )
    expect(withMap).toEqual({ renderer: 'status_badge', label: 'Active', tone: 'success' })

    const withColumnTone = resolveCellContent({ key: 'status', renderer: 'badge', tone: 'info' }, { status: 'Draft' })
    expect(withColumnTone.tone).toBe('info')

    const withDefault = resolveCellContent({ key: 'status', renderer: 'badge' }, { status: 'Draft' })
    expect(withDefault.tone).toBe('gray')
  })

  it('builds link content from hrefKey or the value itself', () => {
    const withHrefKey = resolveCellContent(
      { key: 'label', renderer: 'link', hrefKey: 'url' },
      { label: 'Docs', url: 'https://example.com' }
    )
    expect(withHrefKey).toEqual({ renderer: 'link', label: 'Docs', href: 'https://example.com' })

    const withValueAsHref = resolveCellContent({ key: 'url', renderer: 'link' }, { url: 'https://example.com' })
    expect(withValueAsHref.href).toBe('https://example.com')
  })

  it('formats dates and numbers, leaving invalid input untouched as a string', () => {
    expect(formatDateValue('')).toBe('')
    expect(formatDateValue('not-a-date')).toBe('not-a-date')
    expect(formatDateValue('2026-01-15')).toContain('2026')

    expect(formatNumberValue('')).toBe('')
    expect(formatNumberValue('not-a-number')).toBe('not-a-number')
    expect(formatNumberValue(1234)).toBe((1234).toLocaleString())
  })

  it('formats datetime with day precision AND time of day, unlike formatDateValue', () => {
    expect(formatDateTimeValue('')).toBe('')
    expect(formatDateTimeValue('not-a-date')).toBe('not-a-date')

    const formatted = formatDateTimeValue('2026-01-15T14:30:00Z')
    expect(formatted).toContain('2026')
    expect(formatted).not.toBe(formatDateValue('2026-01-15T14:30:00Z'))
  })

  it('resolves the datetime renderer through resolveCellContent', () => {
    const content = resolveCellContent({ key: 'created_at', renderer: 'datetime' }, { created_at: '2026-01-15T14:30:00Z' })
    expect(content.renderer).toBe('datetime')
    expect(content.label).toContain('2026')
  })
})
