import { describe, expect, it } from 'vitest'
import { dotColor, statusLabel } from './campaignHelpers.js'

describe('campaignHelpers', () => {
  it('maps campaign statuses to display labels and badge classes', () => {
    expect(statusLabel('active')).toEqual({ label: 'Running', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' })
    expect(statusLabel('completed')).toEqual({ label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' })
    expect(statusLabel('paused')).toEqual({ label: 'Paused', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' })
    expect(statusLabel('draft')).toEqual({ label: 'Draft', cls: 'bg-panel-muted text-ink-muted' })
    expect(statusLabel('scheduled')).toEqual({ label: 'Scheduled', cls: 'bg-panel-muted text-ink-muted' })
  })

  it('maps campaign statuses to dot colors', () => {
    expect(dotColor('active')).toBe('bg-blue-500')
    expect(dotColor('completed')).toBe('bg-emerald-500')
    expect(dotColor('paused')).toBe('bg-amber-500')
    expect(dotColor('scheduled')).toBe('bg-ink-faint')
  })
})
