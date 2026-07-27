import { describe, expect, it } from 'vitest'
import {
  EMPTY_SMTP_FORM,
  buildGophishSmtpPayload,
  buildSmtpProfilePayload,
  extractEmailAddress,
  getSmtpEncryptionForPort,
  gophishSmtpProfileToUiProfile,
  hasDuplicateSmtpProfileName,
  profileToSmtpForm,
  splitSmtpHost,
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
      entity: 'EntityA',
      ignoreCert: true,
      headers: [{ key: 'X-Mailer', val: 'Pukat' }],
    }

    const form = profileToSmtpForm(profile, 'dup')

    expect(form.name).toBe('finance-relay (copy)')
    expect(form.password).toBe('')
    expect(form.entity).toBe('EntityA')
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
        entity: ' EntityA ',
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
      entity: 'EntityA',
      username: 'relay-user',
      used: '3 playbooks',
      assignedTo: 'specific',
      users: [2, 3],
      headers: [{ key: 'X-Mailer', val: 'Pukat' }],
    })
  })

  it('maps GoPhish SMTP profiles into UI profiles without exposing passwords', () => {
    const profile = gophishSmtpProfileToUiProfile({
      id: 7,
      name: 'GoPhish SMTP',
      host: 'smtp.example.test:465',
      from_address: 'Security <security@example.test>',
      entity: 'EntityA',
      username: 'relay-user',
      password: 'secret',
      ignore_cert_errors: true,
      modified_date: '2026-07-23T00:00:00Z',
      headers: [{ key: 'X-Mailer', value: 'Pukat' }],
    })

    expect(profile).toMatchObject({
      id: 7,
      name: 'GoPhish SMTP',
      host: 'smtp.example.test',
      port: 465,
      encryption: 'SSL',
      from: 'Security <security@example.test>',
      entity: 'EntityA',
      username: 'relay-user',
      password: '',
      ignoreCert: true,
      headers: [{ key: 'X-Mailer', val: 'Pukat' }],
    })
  })

  it('builds GoPhish SMTP payloads with host and port combined', () => {
    expect(splitSmtpHost('smtp.example.test:25')).toEqual({ host: 'smtp.example.test', port: 25 })
    expect(getSmtpEncryptionForPort(25)).toBe('None')
    expect(extractEmailAddress('Security <security@example.test>')).toBe('security@example.test')

    const payload = buildGophishSmtpPayload({
      form: {
        ...EMPTY_SMTP_FORM,
        name: 'GoPhish SMTP',
        host: 'smtp.example.test',
        port: '587',
        from: 'Security <security@example.test>',
        entity: 'EntityA',
        username: ' relay-user ',
        password: 'secret',
        headers: [{ key: ' X-Mailer ', val: ' Pukat ' }],
      },
    })

    expect(payload).toMatchObject({
      name: 'GoPhish SMTP',
      interface_type: 'SMTP',
      host: 'smtp.example.test:587',
      port: 587,
      from_address: 'security@example.test',
      entity: 'EntityA',
      username: 'relay-user',
      password: 'secret',
      headers: [{ key: 'X-Mailer', value: 'Pukat' }],
    })
  })
})
