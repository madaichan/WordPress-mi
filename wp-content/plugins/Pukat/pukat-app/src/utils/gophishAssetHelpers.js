function normalizedText(value) {
  return String(value || '').toLowerCase()
}

export function inferEmailTemplateCategory(template) {
  const text = normalizedText(`${template.name || ''} ${template.subject || ''}`)

  if (/(urgent|mendesak|required|tunggakan|warning|peringatan|bayar|locked|suspend)/.test(text)) {
    return 'urgent'
  }

  if (/(payroll|hr|info|slip|benefit|policy|internal)/.test(text)) {
    return 'info'
  }

  return 'alert'
}

export function emailTemplateThumbnail(category) {
  if (category === 'urgent') {
    return {
      icon: 'ti-alert-triangle',
      bg: 'bg-yellow-500/20 text-yellow-500',
      bars: [{ w: 'w-24' }],
    }
  }

  if (category === 'info') {
    return {
      icon: 'ti-receipt',
      bg: 'bg-emerald-500/20 text-emerald-500',
      bars: [{ w: 'w-16' }],
    }
  }

  return {
    icon: 'ti-mail-opened',
    bg: 'bg-red-500/20 text-red-500',
    bars: [{ w: 'w-16' }, { w: 'w-24' }],
  }
}

export function gophishEmailTemplateToUiTemplate(template) {
  const category = inferEmailTemplateCategory(template)
  const activeCampaignRunCount = Number(template.usage?.active_campaign_run_count || 0)
  const activePlaybookCount = Number(template.usage?.active_playbook_count || 0)
  const activeLegacyCampaignCount = Number(template.usage?.active_legacy_campaign_count || 0)
  const activeUsageCount = Number(template.usage?.active_usage_count || activeCampaignRunCount + activePlaybookCount + activeLegacyCampaignCount || 0)

  return {
    id: template.id,
    name: template.name || `Email template ${template.id}`,
    category,
    status: 'Published',
    description: template.modified_date ? 'Synced from GoPhish.' : 'GoPhish email template.',
    sender: template.envelope_sender || template.sender || '',
    subject: template.subject || '',
    html: template.html || '',
    text: template.text || '',
    attachments: template.attachments || [],
    entity: template.entity || '',
    assignedTo: 'all',
    users: [],
    editLocked: Boolean(template.edit_locked) || activeUsageCount > 0,
    activeCampaignRunCount,
    activePlaybookCount,
    activeLegacyCampaignCount,
    activeUsageCount,
    editLockReason: template.edit_lock_reason || 'This email template is used by an active campaign or playbook.',
    thumbnail: emailTemplateThumbnail(category),
    raw: template,
  }
}

export function buildGophishEmailTemplatePayload({
  name,
  sender,
  subject,
  html,
  text = '',
  attachments = [],
  entity = '',
}) {
  return {
    name: name.trim(),
    envelope_sender: sender.trim(),
    subject: subject.trim(),
    html,
    text,
    attachments,
    entity: entity.trim(),
  }
}

export function landingBadges({ captureData, capturePass }) {
  return [
    ...(captureData ? ['Data'] : []),
    ...(capturePass ? ['Pass'] : []),
  ]
}

export function landingCategoryForCapture({ captureData, capturePass, redirectUrl }) {
  if (capturePass) return 'login'
  if (captureData) return 'form'
  if (redirectUrl) return 'redirect'
  return 'form'
}

export function landingPageThumbnail(category) {
  if (category === 'redirect') {
    return {
      accent: null,
      bars: [{ w: 'w-3/4' }],
    }
  }

  if (category === 'form') {
    return {
      accent: null,
      bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
    }
  }

  return {
    accent: null,
    bars: [{ w: 'w-full' }, { w: 'w-4/5' }],
  }
}

export function gophishLandingPageToUiPage(page) {
  const captureData = Boolean(page.capture_credentials)
  const capturePass = Boolean(page.capture_passwords)
  const redirectUrl = page.redirect_url || ''
  const category = landingCategoryForCapture({ captureData, capturePass, redirectUrl })
  const activeCampaignRunCount = Number(page.usage?.active_campaign_run_count || 0)
  const activePlaybookCount = Number(page.usage?.active_playbook_count || 0)
  const activeLegacyCampaignCount = Number(page.usage?.active_legacy_campaign_count || 0)
  const activeUsageCount = Number(page.usage?.active_usage_count || activeCampaignRunCount + activePlaybookCount + activeLegacyCampaignCount || 0)

  return {
    id: page.id,
    name: page.name || `Landing page ${page.id}`,
    category,
    description: page.modified_date ? 'Synced from GoPhish.' : 'GoPhish landing page.',
    html: page.html || '',
    redirectUrl,
    entity: page.entity || '',
    badges: landingBadges({ captureData, capturePass }),
    assignedTo: 'all',
    users: [],
    editLocked: Boolean(page.edit_locked) || activeUsageCount > 0,
    activeCampaignRunCount,
    activePlaybookCount,
    activeLegacyCampaignCount,
    activeUsageCount,
    editLockReason: page.edit_lock_reason || 'This landing page is used by an active campaign or playbook.',
    thumbnail: landingPageThumbnail(category),
    raw: page,
  }
}

export function buildGophishLandingPagePayload({
  name,
  html,
  redirectUrl,
  captureData,
  capturePass,
  entity = '',
}) {
  return {
    name: name.trim(),
    html,
    capture_credentials: Boolean(captureData),
    capture_passwords: Boolean(capturePass),
    redirect_url: redirectUrl.trim(),
    entity: entity.trim(),
  }
}
