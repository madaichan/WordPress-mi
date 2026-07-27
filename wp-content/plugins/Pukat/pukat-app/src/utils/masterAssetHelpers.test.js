import { describe, expect, it } from 'vitest'
import {
  buildMasterEmailTemplatePayload,
  buildMasterLandingPagePayload,
  masterEmailTemplateToUiTemplate,
  masterLandingPageToUiPage,
} from './masterAssetHelpers.js'

describe('masterAssetHelpers', () => {
  it('maps email template masters from latest version data', () => {
    const template = masterEmailTemplateToUiTemplate({
      id: 11,
      name: 'Security Alert',
      category: 'alert',
      entity: 'Finance',
      status: 'active',
      latest_version: {
        id: 45,
        version: 3,
        subject: 'Verify your account',
        html_body: '<p>Hello {{.FirstName}}</p>',
        text_body: 'Hello',
        status: 'approved',
      },
    })

    expect(template).toMatchObject({
      id: 11,
      versionId: 45,
      version: 3,
      name: 'Security Alert',
      entity: 'Finance',
      status: 'Published',
      subject: 'Verify your account',
      html: '<p>Hello {{.FirstName}}</p>',
    })
  })

  it('builds versioned email payloads for publish flow', () => {
    const payload = buildMasterEmailTemplatePayload({
      name: ' Security Alert ',
      category: 'urgent',
      status: 'Published',
      entity: '',
      subject: ' Verify ',
      html: '<p>Verify</p>',
    })

    expect(payload).toEqual({
      publish: true,
      master: {
        name: 'Security Alert',
        description: '',
        category: 'urgent',
        entity: 'General',
        status: 'active',
      },
      version: {
        subject: 'Verify',
        html_body: '<p>Verify</p>',
        text_body: '',
        variables: [],
        language: 'id',
      },
    })
  })

  it('maps landing page capture and redirect settings', () => {
    const page = masterLandingPageToUiPage({
      id: 8,
      name: 'Portal Login',
      entity: 'HR',
      status: 'active',
      latest_version: {
        id: 20,
        version: 2,
        html_body: '<form></form>',
        capture_settings: {
          capture_credentials: true,
          capture_passwords: true,
        },
        redirect_settings: {
          redirect_url: 'https://portal.example.test',
        },
        status: 'approved',
      },
    })

    expect(page).toMatchObject({
      id: 8,
      versionId: 20,
      category: 'login',
      badges: ['Data', 'Pass'],
      redirectUrl: 'https://portal.example.test',
      status: 'Published',
    })
  })

  it('builds landing page payloads with CampaignRun-compatible setting names', () => {
    const payload = buildMasterLandingPagePayload({
      name: 'Portal Login',
      html: '<form></form>',
      redirectUrl: 'https://portal.example.test',
      captureData: true,
      capturePass: false,
      entity: 'HR',
      status: 'Draft',
    })

    expect(payload).toMatchObject({
      publish: false,
      master: {
        name: 'Portal Login',
        category: 'form',
        entity: 'HR',
        status: 'draft',
      },
      version: {
        capture_settings: {
          capture_credentials: true,
          capture_passwords: false,
        },
        redirect_settings: {
          redirect_url: 'https://portal.example.test',
        },
      },
    })
  })
})
