import { describe, expect, it } from 'vitest'
import {
  buildGophishEmailTemplatePayload,
  buildGophishLandingPagePayload,
  gophishEmailTemplateToUiTemplate,
  gophishLandingPageToUiPage,
} from './gophishAssetHelpers.js'

describe('gophishAssetHelpers', () => {
  it('maps GoPhish email templates into UI templates', () => {
    const template = gophishEmailTemplateToUiTemplate({
      id: 11,
      name: 'Payroll Notice',
      subject: 'Internal payroll update',
      envelope_sender: 'HR <hr@example.test>',
      html: '<p>{{.URL}}</p>',
      text: 'Open {{.URL}}',
      attachments: [],
      entity: 'EntityA',
      modified_date: '2026-07-23T00:00:00Z',
    })

    expect(template).toMatchObject({
      id: 11,
      name: 'Payroll Notice',
      category: 'info',
      sender: 'HR <hr@example.test>',
      subject: 'Internal payroll update',
      html: '<p>{{.URL}}</p>',
      text: 'Open {{.URL}}',
      attachments: [],
      entity: 'EntityA',
      assignedTo: 'all',
      users: [],
    })
  })

  it('builds trimmed GoPhish email template payloads', () => {
    expect(buildGophishEmailTemplatePayload({
      name: ' Security Alert ',
      sender: ' Security <security@example.test> ',
      subject: ' Verify login ',
      html: '<p>{{.URL}}</p>',
      attachments: [],
      entity: ' EntityA ',
    })).toEqual({
      name: 'Security Alert',
      envelope_sender: 'Security <security@example.test>',
      subject: 'Verify login',
      html: '<p>{{.URL}}</p>',
      text: '',
      attachments: [],
      entity: 'EntityA',
    })
  })

  it('maps GoPhish landing pages into UI pages', () => {
    const page = gophishLandingPageToUiPage({
      id: 7,
      name: 'VPN Login',
      html: '<form></form>',
      redirect_url: 'https://example.test',
      capture_credentials: true,
      capture_passwords: true,
      entity: 'EntityB',
    })

    expect(page).toMatchObject({
      id: 7,
      name: 'VPN Login',
      category: 'login',
      redirectUrl: 'https://example.test',
      entity: 'EntityB',
      badges: ['Data', 'Pass'],
      assignedTo: 'all',
      users: [],
    })
  })

  it('builds GoPhish landing page payloads', () => {
    expect(buildGophishLandingPagePayload({
      name: ' Redirect Page ',
      html: '<p>Thanks</p>',
      redirectUrl: ' https://example.test/thanks ',
      captureData: false,
      capturePass: false,
      entity: ' EntityB ',
    })).toEqual({
      name: 'Redirect Page',
      html: '<p>Thanks</p>',
      capture_credentials: false,
      capture_passwords: false,
      redirect_url: 'https://example.test/thanks',
      entity: 'EntityB',
    })
  })
})
