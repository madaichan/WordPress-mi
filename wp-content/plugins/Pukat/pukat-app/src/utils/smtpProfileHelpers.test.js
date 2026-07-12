import { describe, expect, it } from 'vitest'
import {
  EMPTY_SMTP_FORM,
  buildSmtpProfilePayload,
  hasDuplicateSmtpProfileName,
  profileToSmtpForm,
} from './smtpProfileHelpers.js'

describe('smtpProfileHelpers', () => {
  it('prepares duplicate forms without copying the password', () => {
    const profile = {
      name: 'finance-relay',
      host: 'smtp.example.test',
      port: 587,
      encryption: 'TLS',
      username: 'relay-user',
      password: 'secret',
      from: 'Security <security@example.test>',
      ignoreCert: true,
      headers: [{ key: 'X-Mailer', val: 'Pukat' }],
    }

    const form = profileToSmtpForm(profile, 'dup')

    expect(form.name).toBe('finance-relay (copy)')
    expect(form.password).toBe('')
    expect(form.headers).toEqual([{ key: 'X-Mailer', val: 'Pukat' }])
    expect(form.headers).not.toBe(profile.headers)
  })

  it('detects duplicate SMTP profile names case-insensitively', () => {
    const profiles = [
      { id: 'smtp-1', name: 'Finance Relay' },
      { id: 'smtp-2', name: 'HR Relay' },
    ]

    expect(hasDuplicateSmtpProfileName(profiles, 'finance relay', 'smtp-2')).toBe(true)
    expect(hasDuplicateSmtpProfileName(profiles, 'finance relay', 'smtp-1')).toBe(false)
  })

  it('builds trimmed update payloads and preserves assignment when requested', () => {
    const sourceProfile = {
      id: 'smtp-1',
      used: '3 playbooks',
      assignedTo: 'specific',
      users: [2, 3],
    }

    const payload = buildSmtpProfilePayload({
      form: {
        ...EMPTY_SMTP_FORM,
        name: ' Finance Relay ',
        host: ' smtp.example.test ',
        from: ' Security <security@example.test> ',
        username: ' relay-user ',
        headers: [
          { key: ' X-Mailer ', val: ' Pukat ' },
          { key: ' ', val: ' skipped ' },
        ],
      },
      mode: 'update',
      sourceProfile,
      includeAssignment: true,
    })

    expect(payload).toMatchObject({
      id: 'smtp-1',
      name: 'Finance Relay',
      host: 'smtp.example.test',
      port: 587,
      from: 'Security <security@example.test>',
      username: 'relay-user',
      used: '3 playbooks',
      assignedTo: 'specific',
      users: [2, 3],
      headers: [{ key: 'X-Mailer', val: 'Pukat' }],
    })
  })
})
