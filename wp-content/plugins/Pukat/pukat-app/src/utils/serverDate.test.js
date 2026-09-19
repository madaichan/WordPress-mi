import { describe, expect, it } from 'vitest'
import { parseServerDate } from './serverDate.js'

describe('parseServerDate', () => {
  it('returns null for empty/falsy values', () => {
    expect(parseServerDate(null)).toBeNull()
    expect(parseServerDate(undefined)).toBeNull()
    expect(parseServerDate('')).toBeNull()
  })

  it('treats a naive "Y-m-d H:i:s" backend timestamp as UTC', () => {
    const date = parseServerDate('2026-09-18 03:00:00')
    expect(date.toISOString()).toBe('2026-09-18T03:00:00.000Z')
  })

  it('respects an explicit offset/zone instead of forcing UTC', () => {
    expect(parseServerDate('2026-09-18T10:00:00+07:00').toISOString()).toBe('2026-09-18T03:00:00.000Z')
    expect(parseServerDate('2026-09-18T03:00:00Z').toISOString()).toBe('2026-09-18T03:00:00.000Z')
  })

  it('passes a Date instance through unchanged', () => {
    const input = new Date('2026-09-18T03:00:00.000Z')
    expect(parseServerDate(input)).toBe(input)
  })

  it('returns null for unparseable input', () => {
    expect(parseServerDate('not-a-date')).toBeNull()
  })

  it('leaves a date-only "Y-m-d" string as already UTC', () => {
    expect(parseServerDate('2026-09-18').toISOString()).toBe('2026-09-18T00:00:00.000Z')
  })
})
