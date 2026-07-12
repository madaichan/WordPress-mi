import { describe, expect, it } from 'vitest'
import { dotColor, statusLabel } from './campaignHelpers.js'

describe('campaignHelpers', () => {
  it('maps campaign statuses to display labels and badge classes', () => {
    expect(statusLabel('active')).toEqual({ label: 'Running', cls: 'bg-blue-100 text-blue-700' })
    expect(statusLabel('completed')).toEqual({ label: 'Completed', cls: 'bg-emerald-100 text-emerald-700' })
    expect(statusLabel('paused')).toEqual({ label: 'Paused', cls: 'bg-amber-100 text-amber-700' })
    expect(statusLabel('draft')).toEqual({ label: 'Draft', cls: 'bg-gray-100 text-gray-500' })
    expect(statusLabel('scheduled')).toEqual({ label: 'Scheduled', cls: 'bg-gray-100 text-gray-600' })
  })

  it('maps campaign statuses to dot colors', () => {
    expect(dotColor('active')).toBe('bg-blue-500')
    expect(dotColor('completed')).toBe('bg-emerald-500')
    expect(dotColor('paused')).toBe('bg-amber-500')
    expect(dotColor('scheduled')).toBe('bg-gray-400')
  })
})
