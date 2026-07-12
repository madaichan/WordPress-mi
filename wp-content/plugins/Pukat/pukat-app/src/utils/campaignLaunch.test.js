import { describe, expect, it } from 'vitest'
import { buildCampaignLaunchPayload, timezoneForRegion } from './campaignLaunch.js'

describe('campaignLaunch', () => {
  it('maps Indonesian time regions to IANA timezones', () => {
    expect(timezoneForRegion('WIB')).toBe('Asia/Jakarta')
    expect(timezoneForRegion('WITA')).toBe('Asia/Makassar')
    expect(timezoneForRegion('WIT')).toBe('Asia/Jayapura')
    expect(timezoneForRegion('UTC')).toBe('Asia/Jakarta')
  })

  it('builds launch payload from wizard form and selected playbook', () => {
    const payload = buildCampaignLaunchPayload(
      { name: 'Finance wave', playbook: 'p2', timezone: 'WITA' },
      [{ id: 'p1', diff: 2 }, { id: 'p2', diff: 5 }]
    )

    expect(payload).toEqual({
      name: 'Finance wave',
      difficulty: 5,
      timezone: 'Asia/Makassar',
    })
  })

  it('uses default difficulty when playbook is missing', () => {
    expect(buildCampaignLaunchPayload({ name: 'Custom', playbook: 'missing', timezone: 'WIB' }, [])).toMatchObject({
      difficulty: 3,
    })
  })
})
