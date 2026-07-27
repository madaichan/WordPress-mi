import {
  emailTemplateThumbnail,
  inferEmailTemplateCategory,
  landingBadges,
  landingCategoryForCapture,
  landingPageThumbnail,
} from './gophishAssetHelpers.js'

const READY_STATUSES = new Set(['approved', 'active'])

function trimOrDefault(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function latestVersion(master) {
  if (master?.latest_version) return master.latest_version
  if (Array.isArray(master?.versions) && master.versions.length) return master.versions[0]
  return null
}

function displayStatus(status) {
  return READY_STATUSES.has(String(status || '').toLowerCase()) ? 'Published' : 'Draft'
}

function masterStatusFromDisplay(status) {
  return status === 'Published' ? 'active' : 'draft'
}

function versionVariables(variables) {
  return Array.isArray(variables) ? variables : []
}

export function masterEmailTemplateToUiTemplate(master) {
  const version = latestVersion(master)
  const category = master.category || inferEmailTemplateCategory({
    name: master.name,
    subject: version?.subject,
  })

  return {
    id: master.id,
    versionId: version?.id ?? null,
    version: version?.version ?? null,
    name: master.name || `Email template ${master.id}`,
    category,
    status: displayStatus(version?.status || master.status),
    masterStatus: master.status || 'draft',
    versionStatus: version?.status || 'draft',
    description: master.description || (version?.version ? `Master version ${version.version}` : 'WordPress master email template.'),
    sender: master.sender || '',
    subject: version?.subject || '',
    html: version?.html_body || version?.html || '',
    text: version?.text_body || version?.text || '',
    language: version?.language || 'id',
    variables: versionVariables(version?.variables),
    attachments: [],
    entity: master.entity || '',
    assignedTo: 'all',
    users: [],
    thumbnail: emailTemplateThumbnail(category),
    raw: master,
  }
}

export function buildMasterEmailTemplatePayload({
  name,
  category = 'alert',
  status = 'Published',
  entity = '',
  subject,
  html,
  text = '',
  variables = [],
  language = 'id',
  description = '',
}) {
  return {
    publish: status === 'Published',
    master: {
      name: name.trim(),
      description: description.trim(),
      category,
      entity: trimOrDefault(entity, 'General'),
      status: masterStatusFromDisplay(status),
    },
    version: {
      subject: subject.trim(),
      html_body: html,
      text_body: text,
      variables: versionVariables(variables),
      language,
    },
  }
}

export function masterLandingPageToUiPage(master) {
  const version = latestVersion(master)
  const captureSettings = version?.capture_settings || {}
  const redirectSettings = version?.redirect_settings || {}
  const captureData = Boolean(captureSettings.capture_credentials)
  const capturePass = Boolean(captureSettings.capture_passwords)
  const redirectUrl = redirectSettings.redirect_url || ''
  const category = master.category || landingCategoryForCapture({ captureData, capturePass, redirectUrl })

  return {
    id: master.id,
    versionId: version?.id ?? null,
    version: version?.version ?? null,
    name: master.name || `Landing page ${master.id}`,
    category,
    status: displayStatus(version?.status || master.status),
    masterStatus: master.status || 'draft',
    versionStatus: version?.status || 'draft',
    description: master.description || (version?.version ? `Master version ${version.version}` : 'WordPress master landing page.'),
    html: version?.html_body || version?.html || '',
    redirectUrl,
    entity: master.entity || '',
    badges: landingBadges({ captureData, capturePass }),
    assignedTo: 'all',
    users: [],
    thumbnail: landingPageThumbnail(category),
    raw: master,
  }
}

export function buildMasterLandingPagePayload({
  name,
  html,
  redirectUrl,
  captureData,
  capturePass,
  entity = '',
  status = 'Published',
  language = 'id',
  description = '',
}) {
  const category = landingCategoryForCapture({ captureData, capturePass, redirectUrl })

  return {
    publish: status === 'Published',
    master: {
      name: name.trim(),
      description: description.trim(),
      category,
      entity: trimOrDefault(entity, 'General'),
      status: masterStatusFromDisplay(status),
    },
    version: {
      html_body: html,
      capture_settings: {
        capture_credentials: Boolean(captureData),
        capture_passwords: Boolean(capturePass),
      },
      redirect_settings: {
        redirect_url: redirectUrl.trim(),
      },
      variables: [],
      language,
    },
  }
}
