import { describe, expect, it } from 'vitest'
import {
  buildMasterEmailTemplatePayload,
  buildMasterLandingPagePayload,
  masterEmailTemplateToUiTemplate,
  masterLandingPageToUiPage,
  playbookDisplayStatus,
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
        created_by: 7,
        updated_by: 9,
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
      versionCreatedBy: 7,
      versionUpdatedBy: 9,
    })
  })

  it('builds versioned email payloads without a status/publish field', () => {
    const payload = buildMasterEmailTemplatePayload({
      name: ' Security Alert ',
      category: 'urgent',
      entity: '',
      subject: ' Verify ',
      html: '<p>Verify</p>',
    })

    expect(payload).toEqual({
      master: {
        name: 'Security Alert',
        description: '',
        category: 'urgent',
        entity: 'General',
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

  it('builds landing page payloads with CampaignRun-compatible setting names, no status/publish field', () => {
    const payload = buildMasterLandingPagePayload({
      name: 'Portal Login',
      html: '<form></form>',
      redirectUrl: 'https://portal.example.test',
      captureData: true,
      capturePass: false,
      entity: 'HR',
    })

    expect(payload).toMatchObject({
      master: {
        name: 'Portal Login',
        category: 'form',
        entity: 'HR',
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
    expect(payload.master.status).toBeUndefined()
    expect(payload.publish).toBeUndefined()
  })

  it('maps playbook lifecycle statuses to display labels', () => {
    expect(playbookDisplayStatus('draft')).toBe('Draft')
    expect(playbookDisplayStatus('review')).toBe('Review')
    expect(playbookDisplayStatus('approved')).toBe('Published')
    expect(playbookDisplayStatus('active')).toBe('Published')
    expect(playbookDisplayStatus('deprecated')).toBe('Deprecated')
    expect(playbookDisplayStatus('archived')).toBe('Archived')
    expect(playbookDisplayStatus(undefined)).toBe('Draft')
  })
})
