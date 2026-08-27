import { describe, expect, it } from 'vitest'
import {
  buildCampaignLaunchPayload,
  buildTargetImportPayload,
  playbookMasterIdForForm,
  scheduleAtForDate,
  timezoneForRegion,
} from './campaignLaunch.js'

describe('campaignLaunch', () => {
  it('maps Indonesian time regions to IANA timezones', () => {
    expect(timezoneForRegion('WIB')).toBe('Asia/Jakarta')
    expect(timezoneForRegion('WITA')).toBe('Asia/Makassar')
    expect(timezoneForRegion('WIT')).toBe('Asia/Jayapura')
    expect(timezoneForRegion('UTC')).toBe('Asia/Jakarta')
  })

  it('normalizes schedule dates for Campaign Run API', () => {
    expect(scheduleAtForDate('2026-08-10')).toBe('2026-08-10 09:00:00')
    expect(scheduleAtForDate('2026-08-10T13:15:30.000Z')).toBe('2026-08-10 13:15:30')
    expect(scheduleAtForDate('')).toBeNull()
  })

  it('applies an explicit send time to a date-only schedule', () => {
    expect(scheduleAtForDate('2026-08-10', '14:30')).toBe('2026-08-10 14:30:00')
    expect(scheduleAtForDate('2026-08-10', 'not-a-time')).toBe('2026-08-10 09:00:00')
  })

  it('resolves selected Playbook Master ID as a number', () => {
    expect(playbookMasterIdForForm({ playbook: '24' }, [{ id: '24' }])).toBe(24)
    expect(playbookMasterIdForForm({ playbook: 'missing' }, [])).toBeNull()
  })

  it('builds launch payload from wizard form and selected playbook', () => {
    const payload = buildCampaignLaunchPayload(
      { name: ' Finance wave ', playbook: '24', timezone: 'WITA', dateStart: '2026-08-10', sendTime: '16:45' },
      [{ id: '11', diff: 2 }, { id: '24', diff: 5 }]
    )

    expect(payload).toEqual({
      playbook_master_id: 24,
      name: 'Finance wave',
      difficulty: 5,
      timezone: 'Asia/Makassar',
      schedule_at: '2026-08-10 16:45:00',
      target_group_name: null,
      follow_up: {
        quiz_enabled: true,
        force_reset_password_reminder_enabled: false,
      },
    })
  })

  it('uses default difficulty when playbook is missing', () => {
    expect(buildCampaignLaunchPayload({ name: 'Custom', playbook: 'missing', timezone: 'WIB' }, [])).toMatchObject({
      playbook_master_id: null,
      difficulty: 3,
    })
  })

  it('defaults follow-up preferences when unset, and passes through explicit choices', () => {
    expect(buildCampaignLaunchPayload({ name: 'Defaults', timezone: 'WIB' }, [])).toMatchObject({
      follow_up: { quiz_enabled: true, force_reset_password_reminder_enabled: false },
    })

    expect(buildCampaignLaunchPayload(
      { name: 'Custom follow-up', timezone: 'WIB', followUp: { quizEnabled: false, forceResetPasswordReminderEnabled: true } },
      []
    )).toMatchObject({
      follow_up: { quiz_enabled: false, force_reset_password_reminder_enabled: true },
    })
  })

  it('maps parsed CSV rows into the targets/import payload shape, tolerating alternate name casings', () => {
    expect(buildTargetImportPayload([
      { email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe', department: 'Finance', position: 'Analyst' },
      { email: 'bob@example.com', firstname: 'Bob', lastname: 'Lee' },
    ])).toEqual([
      { email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe', department: 'Finance', position: 'Analyst' },
      { email: 'bob@example.com', first_name: 'Bob', last_name: 'Lee', department: '', position: '' },
    ])
  })
})
